import { describe, expect, test } from "bun:test";
import { Draft, type DraftState } from "../../../src/drafts/domain/draft";
import { LogUnavailable } from "../../../src/drafts/domain/errors";
import type { DraftLogRepository } from "../../../src/drafts/ports/log";
import { CreateDraftUseCase } from "../../../src/drafts/application/create-draft";
import { FakeChatReader } from "../../../src/drafts/adapters/memory/fake-chat-reader";
import { FakeOrderPreparer } from "../../../src/drafts/adapters/memory/fake-order-preparer";
import type { ChatId } from "../../../src/shared/chat-id";
import type { Clock } from "../../../src/shared/clock";
import { makeDrafts, message } from "./harness";

const chat = "chat-a" as ChatId;
const question = [message("m1", "customer", "How much is the cake?", 900)];
const base = { chats: { "chat-a": question } };

async function value<T>(r: Promise<{ ok: true; value: T } | { ok: false; refusal: { code: string } }>): Promise<T> {
  const out = await r;
  if (!out.ok) throw new Error(`refused: ${out.refusal.code}`);
  return out.value;
}

async function seed(h: ReturnType<typeof makeDrafts>, number: number, state: DraftState) {
  const r = Draft.propose({
    number, kind: "reply", chat, text: "old", now: 500, dev: false, answers: null,
    basis: { messageId: { provider: "dev", providerMessageId: "m1" }, sentAt: 900 }, checkedStoredAt: 500, orderPayload: null,
  });
  if (!("draft" in r)) throw new Error("fixture refused");
  const d = Draft.rehydrate({ ...r.draft.snapshot(), state });
  await h.store.unitOfWork.run(async (tx) => {
    for (let n = 0; n < number; n++) await tx.drafts.nextNumber();
    await tx.drafts.save(d);
  });
}

describe("FR-DRAFTS-01-1", () => {
  test("the result carries number, text and the answered message; basis is the latest message; checkedThrough.storedAt is read before describe", async () => {
    let time = 1_000;
    const clock: Clock = { now: () => time, sleep: async () => {} };
    const h = makeDrafts({ ...base, clock });
    h.chats.onDescribe = () => {
      time += 100;
    };
    const r = await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "  It costs 10\n" }));
    expect(r).toMatchObject({ number: 1, kind: "reply", state: "waiting", chat: "chat-a", madeAt: 1_100, text: "  It costs 10\n", replaced: null });
    expect(r.answers).toMatchObject({ id: "dev:m1", text: "How much is the cake?" });
    const stored = (await h.store.unitOfWork.run((tx) => tx.drafts.get(1)))?.snapshot();
    expect(stored?.basis).toEqual({ messageId: { provider: "dev", providerMessageId: "m1" }, sentAt: 900 });
    expect(stored?.checkedThrough.storedAt).toBe(1_000);
    expect(stored?.madeAt).toBe(1_100);
  });

  test("an order draft answers no message", async () => {
    const h = makeDrafts(base);
    const r = await value(h.createDraft.run({ kind: "order", chat: "chat-a", order: { summary: "2 cakes" } }));
    expect(r.answers).toBeNull();
    expect((await h.store.unitOfWork.run((tx) => tx.drafts.get(r.number)))?.snapshot().answers).toBeNull();
  });

  // covers: drafts/FRD-01/EX-1
  // covers: drafts/FRD-01/EX-2
  test("a reply and an order draft share one numbering, and a closed draft never lowers it", async () => {
    const h = makeDrafts({ chats: { "chat-a": question, "chat-b": question } });
    const a = await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "one" }));
    const b = await value(h.createDraft.run({ kind: "order", chat: "chat-a", order: { summary: "2 cakes" } }));
    expect(b.number).toBeGreaterThan(a.number);
    await h.store.unitOfWork.run(async (tx) => {
      const d = await tx.drafts.get(a.number);
      d?.reject({ ownerWords: "no", now: 2_000 });
      if (d) await tx.drafts.save(d);
    });
    const c = await value(h.createDraft.run({ kind: "reply", chat: "chat-b", text: "three" }));
    expect(c.number).toBeGreaterThan(b.number);
  });

  test("an unknown chat, a chat with no customer message and an empty text are refused and nothing is stored", async () => {
    const h = makeDrafts({ chats: { "chat-a": question, owner: [message("o1", "owner_app", "hi", 100)] } });
    const refusal = async (input: Parameters<typeof h.createDraft.run>[0]) => {
      const r = await h.createDraft.run(input);
      return r.ok ? "ok" : r.refusal.code;
    };
    expect(await refusal({ kind: "reply", chat: "nowhere", text: "x" })).toBe("chat_not_found");
    expect(await refusal({ kind: "reply", chat: "owner", text: "x" })).toBe("no_customer_message");
    expect(await refusal({ kind: "reply", chat: "chat-a", text: "  \n" })).toBe("empty_text");
    expect(await h.store.unitOfWork.run((tx) => tx.drafts.listOpen())).toEqual([]);
    expect(await h.store.log.page({ limit: 10 })).toEqual([]);
  });

  test("a refused empty reply burns no draft number: the next draft gets number 1", async () => {
    const h = makeDrafts(base);
    const refused = await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "  \n" });
    expect(refused.ok ? null : refused.refusal.code).toBe("empty_text");
    const next = await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "Hi" });
    expect(next.ok ? next.value.number : null).toBe(1);
  });

  test("not_owner: a process without the lease stores nothing", async () => {
    const h = makeDrafts(base);
    h.holder.token = "other";
    const r = await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "x" });
    expect(r).toEqual({ ok: false, refusal: { code: "not_owner" } });
    h.holder.token = "me";
    expect(await h.store.unitOfWork.run((tx) => tx.drafts.listOpen())).toEqual([]);
  });

  test("an order that the preparer refuses gives order_rejected with the reasons", async () => {
    const h = makeDrafts(base);
    const r = await h.createDraft.run({ kind: "order", chat: "chat-a", order: { fail: "out of stock" } });
    expect(r).toEqual({ ok: false, refusal: { code: "order_rejected", reasons: ["out of stock"] } });
  });

  test("a log append that throws LogUnavailable gives log_unavailable and stores no draft", async () => {
    const failingLog = (log: DraftLogRepository): DraftLogRepository => ({
      append: async () => {
        throw new LogUnavailable();
      },
      page: (f) => log.page(f),
      sentWithApproval: () => log.sentWithApproval(),
      stuckDrafts: () => log.stuckDrafts(),
      scrubOrder: (o, d) => log.scrubOrder(o, d),
      approvalEntryIdFor: (s) => log.approvalEntryIdFor(s),
      hasOrderDeleted: (o) => log.hasOrderDeleted(o),
    });
    const h = makeDrafts({
      ...base,
      unitOfWork: (store) => ({ read: (work) => store.unitOfWork.read(work), run: (work, o) => store.unitOfWork.run((tx) => work({ drafts: tx.drafts, approvals: tx.approvals, log: failingLog(tx.log) }), o) }),
    });
    const r = await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "x" });
    expect(r).toEqual({ ok: false, refusal: { code: "log_unavailable" } });
    expect(await h.store.unitOfWork.run((tx) => tx.drafts.listOpen())).toEqual([]);
  });
});

describe("FR-DRAFTS-01-2", () => {
  test("CreateDraft is built without a sender, makes a waiting draft and sends nothing", async () => {
    const h = makeDrafts(base);
    const useCase = new CreateDraftUseCase({
      clock: h.clock,
      lease: { isOwner: async () => true },
      unitOfWork: h.store.unitOfWork,
      chats: new FakeChatReader(base.chats),
      orders: new FakeOrderPreparer(),
    });
    const r = await value(useCase.run({ kind: "reply", chat: "chat-a", text: "x" }));
    expect(r.state).toBe("waiting");
  });
});

describe("FR-DRAFTS-01-7", () => {
  // covers: drafts/FRD-01/EX-13
  test("a second reply draft replaces the first; the result and the log say so", async () => {
    const h = makeDrafts(base);
    const first = await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "one" }));
    const second = await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "two" }));
    expect(second.replaced).toEqual({ number: first.number, state: "waiting" });
    const old = (await h.store.unitOfWork.run((tx) => tx.drafts.get(first.number)))?.snapshot();
    expect(old).toMatchObject({ state: "replaced", replacedBy: second.number });
    const kinds = (await h.store.log.page({ after: 0, limit: 10 })).map((e) => [e.kind, e.draft]);
    expect(kinds).toEqual([["proposed", first.number], ["replaced", first.number], ["proposed", second.number]]);
  });

  // covers: drafts/FRD-01/EX-15
  test("a reply and an order draft for the same chat both stay open; a later reply replaces only the reply", async () => {
    const h = makeDrafts(base);
    const reply = await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "one" }));
    const order = await value(h.createDraft.run({ kind: "order", chat: "chat-a", order: {} }));
    expect(order.replaced).toBeNull();
    const again = await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "two" }));
    expect(again.replaced?.number).toBe(reply.number);
    const open = await h.store.unitOfWork.run((tx) => tx.drafts.listOpen());
    expect(open.map((d) => d.snapshot().number).sort()).toEqual([order.number, again.number].sort());
  });

  // covers: drafts/FRD-01/EX-14
  test("a replace voids the live approval of the old draft and the entry points to its approved entry", async () => {
    const h = makeDrafts(base);
    const first = await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "one" }));
    await h.store.unitOfWork.run((tx) =>
      tx.approvals.insert({
        id: "ap-1", draftNumber: first.number, textVersion: 1, text: "one", textHash: "h", ownerWords: "go 1",
        approvedAt: 1_000, usedAt: 1_000, sendId: "send-1", voidedAt: null, voidReason: null,
      }),
    );
    const [approvedId] = await h.store.log.append([
      { at: 1_000, kind: "approved", draft: first.number, draftKind: "reply", chat, proposedText: "one", finalText: "one", reason: null, ownerWords: "go 1", approvalEntryId: null, sendId: "send-1", orderRef: null },
    ]);
    await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "two" }));
    const voided = (await h.store.log.page({ after: 0, limit: 10 })).find((e) => e.kind === "approval_voided");
    expect(voided).toMatchObject({ reason: "replaced", approvalEntryId: approvedId, sendId: "send-1" });
    const [row] = await h.store.unitOfWork.run((tx) => tx.approvals.forDraft(first.number));
    expect(row).toMatchObject({ voidReason: "replaced" });
  });

  test.each([["sending", "send_in_progress"], ["recording", "send_in_progress"], ["unknown", "outcome_unknown_open"]] as const)(
    "an existing %s draft gives %s",
    async (state, code) => {
      const h = makeDrafts(base);
      await seed(h, 1, state);
      const r = await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "x" });
      expect(r).toEqual({ ok: false, refusal: { code, number: 1 } });
    },
  );

  test.each(["held", "failed"] as const)("an existing %s draft is replaced and the result carries that state", async (state) => {
    const h = makeDrafts(base);
    await seed(h, 1, state);
    const r = await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "x" }));
    expect(r.replaced).toEqual({ number: 1, state });
  });
});

describe("FR-DRAFTS-01-8", () => {
  const devChat = { "chat-a": [message("d1", "customer", "test", 900, { dev: true })] };
  // covers: drafts/FRD-01/EX-17
  test("a chat of only dev messages is refused while the active world is not dev", async () => {
    const h = makeDrafts({ chats: devChat });
    const r = await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "x" });
    expect(r).toEqual({ ok: false, refusal: { code: "dev_messages_only" } });
  });
  // covers: drafts/FRD-01/EX-18
  test("the same chat is accepted in the dev world and the draft has dev true", async () => {
    const h = makeDrafts({ chats: devChat, activeWorldIsDev: true });
    await value(h.createDraft.run({ kind: "reply", chat: "chat-a", text: "x" }));
    expect((await h.store.unitOfWork.run((tx) => tx.drafts.get(1)))?.snapshot().dev).toBe(true);
  });
});
