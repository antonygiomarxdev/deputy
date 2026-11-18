import { describe, expect, test } from "bun:test";
import { Draft, type DraftKind, type DraftNumber } from "../../../src/drafts/domain/draft";
import { LeaseLost, StaleDraft } from "../../../src/drafts/domain/errors";
import type { UnitOfWork } from "../../../src/drafts/ports/outbound";
import type { ChatId } from "../../../src/shared/chat-id";
import type { MessageId } from "../../../src/shared/message-id";
import type { OwnerLease } from "../../../src/shared/owner-lease";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";
import { FakeClock } from "../../support/fake-clock";

const chatA = "chat-a" as ChatId;
const chatB = "chat-b" as ChatId;
const answered: MessageId = { provider: "dev", providerMessageId: "m:1" };

export function newDraft(number: DraftNumber, kind: DraftKind = "reply", chat: ChatId = chatA, text = "Hello") {
  const r = Draft.propose({
    number,
    kind,
    chat,
    text,
    now: 1_000,
    dev: false,
    answers: kind === "reply" ? answered : null,
    basis: { messageId: answered, sentAt: 900 },
    checkedStoredAt: 950,
    orderPayload: kind === "order" ? '{"items":[]}' : null,
  });
  if (!("draft" in r)) throw new Error("fixture refused");
  return r.draft;
}

export function draftRepositoryContract(name: string, make: (lease: OwnerLease) => UnitOfWork): void {
  const setup = () => {
    const holder: LeaseHolder = { token: "me", heartbeat: 1 };
    const uow = make(new InMemoryOwnerLease(holder, new FakeClock(1), "me"));
    const next = () => uow.run((tx) => tx.drafts.nextNumber());
    return { holder, uow, next };
  };

  describe(`DraftRepository: ${name}`, () => {
    test("FR-DRAFTS-01-1: three nextNumber calls in three transactions give 1, 2, 3", async () => {
      const { next } = setup();
      expect([await next(), await next(), await next()]).toEqual([1, 2, 3]);
    });

    test("FR-DRAFTS-01-1: a transaction that took a number and threw gives it again", async () => {
      const { uow, next } = setup();
      await next();
      await next();
      await next();
      await expect(
        uow.run(async (tx) => {
          expect(await tx.drafts.nextNumber()).toBe(4);
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      expect(await next()).toBe(4);
    });

    test("FR-DRAFTS-01-1: with drafts 1 to 3 closed, nextNumber returns 4", async () => {
      const { uow, next } = setup();
      for (const n of [1, 2, 3]) {
        const number = await next();
        const d = newDraft(number, "reply", `c${n}` as ChatId);
        d.reject({ ownerWords: "no", now: 2_000 });
        await uow.run((tx) => tx.drafts.save(d));
      }
      expect(await next()).toBe(4);
    });

    test("FR-DRAFTS-01-1: a reply draft and an order draft in the same chat get different numbers", async () => {
      const { uow } = setup();
      const [a, b] = await uow.run(async (tx) => [await tx.drafts.nextNumber(), await tx.drafts.nextNumber()]);
      await uow.run(async (tx) => {
        await tx.drafts.save(newDraft(a as number, "reply"));
        await tx.drafts.save(newDraft(b as number, "order"));
      });
      expect(a).not.toBe(b);
    });

    test("FR-DRAFTS-01-7: a second open reply draft for the chat throws; an open order draft saves", async () => {
      const { uow, next } = setup();
      await uow.run(async (tx) => tx.drafts.save(newDraft(await tx.drafts.nextNumber(), "reply", chatA)));
      const second = await next();
      await expect(uow.run((tx) => tx.drafts.save(newDraft(second, "reply", chatA)))).rejects.toThrow();
      await uow.run((tx) => tx.drafts.save(newDraft(second, "order", chatA)));
      await uow.run((tx) => tx.drafts.save(newDraft(second + 1, "reply", chatB)));
    });

    test("FR-DRAFTS-01-7: replacing an open draft saves the old one first, then the new one, in one transaction", async () => {
      const { uow, next } = setup();
      const first = await next();
      await uow.run((tx) => tx.drafts.save(newDraft(first)));
      await uow.run(async (tx) => {
        const second = await tx.drafts.nextNumber();
        const old = await tx.drafts.get(first);
        if (!old) throw new Error("missing");
        expect(old.replaceBy({ number: second, now: 2_000 }).ok).toBe(true);
        await tx.drafts.save(old);
        await tx.drafts.save(newDraft(second));
      });
      const old = await uow.run((tx) => tx.drafts.get(first));
      expect(old?.snapshot()).toMatchObject({ state: "replaced", replacedBy: first + 1 });
      const open = await uow.run((tx) => tx.drafts.listOpen());
      expect(open.map((d) => d.snapshot().number)).toEqual([first + 1]);
    });

    test("FR-DRAFTS-01-7: a replaced draft that points at a draft that does not exist fails at commit and stores nothing", async () => {
      const { uow, next } = setup();
      const first = await next();
      await uow.run((tx) => tx.drafts.save(newDraft(first)));
      await expect(
        uow.run(async (tx) => {
          const old = await tx.drafts.get(first);
          if (!old) throw new Error("missing");
          old.replaceBy({ number: 99, now: 2_000 });
          await tx.drafts.save(old);
        }),
      ).rejects.toThrow();
      expect((await uow.run((tx) => tx.drafts.get(first)))?.snapshot().state).toBe("waiting");
    });

    test("FR-DRAFTS-01-7: saving twice from the same loaded copy throws StaleDraft", async () => {
      const { uow, next } = setup();
      const n = await next();
      await uow.run((tx) => tx.drafts.save(newDraft(n)));
      const a = await uow.run((tx) => tx.drafts.get(n));
      if (!a) throw new Error("missing");
      a.changeText({ text: "one", orderPayload: null, ownerWords: "w", now: 3_000 });
      await uow.run((tx) => tx.drafts.save(a));
      await expect(uow.run((tx) => tx.drafts.save(a))).rejects.toBeInstanceOf(StaleDraft);
      const stored = await uow.run((tx) => tx.drafts.get(n));
      expect(stored?.snapshot().revision).toBe(2);
      expect(stored?.snapshot().currentText).toBe("one");
    });

    test("FR-DRAFTS-01-1: a saved draft reads back field for field, text byte for byte, without approval", async () => {
      const { uow, next } = setup();
      const n = await next();
      const text = "  Hola áé 🍰\nsecond line  ";
      const draft = newDraft(n, "order", chatA, text);
      draft.markShown();
      await uow.run((tx) => tx.drafts.save(draft));
      const back = await uow.run((tx) => tx.drafts.get(n));
      expect(back?.snapshot()).toEqual({ ...draft.snapshot(), approval: null });
      expect(back?.snapshot().currentText).toBe(text);
      expect(await uow.run((tx) => tx.drafts.get(99))).toBeNull();
    });

    test("FR-DRAFTS-01-4: listOpen holds the six open states, none of the closed, and filters by chat", async () => {
      const { uow, next } = setup();
      const open = ["waiting", "held", "failed", "unknown", "sending", "recording"] as const;
      const closed = ["sent", "recorded", "rejected", "replaced"] as const;
      const numbers: number[] = [];
      for (const [i, state] of [...open, ...closed].entries()) {
        const n = await next();
        const d = Draft.rehydrate({ ...newDraft(n, "reply", `c${i}` as ChatId).snapshot(), state });
        await uow.run((tx) => tx.drafts.save(d));
        numbers.push(n);
      }
      const listed = await uow.run((tx) => tx.drafts.listOpen());
      expect(listed.map((d) => d.snapshot().state).sort()).toEqual([...open].sort());
      const one = await uow.run((tx) => tx.drafts.listOpen({ chat: "c1" as ChatId }));
      expect(one.map((d) => d.snapshot().number)).toEqual([numbers[1] as number]);
      const found = await uow.run((tx) => tx.drafts.openFor("c0" as ChatId, "reply"));
      expect(found?.snapshot().state).toBe("waiting");
      expect(await uow.run((tx) => tx.drafts.openFor("c9" as ChatId, "reply"))).toBeNull();
    });

    test("requireLease: a write throws LeaseLost when this process is not the owner; a read may skip the check", async () => {
      const { uow, holder } = setup();
      holder.token = "other";
      await expect(uow.run((tx) => tx.drafts.nextNumber())).rejects.toBeInstanceOf(LeaseLost);
      expect(await uow.run((tx) => tx.drafts.listOpen(), { requireLease: false })).toEqual([]);
    });
  });
}
