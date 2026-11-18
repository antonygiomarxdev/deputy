import { afterEach, describe, expect, test } from "bun:test";
import { InMemoryDrafts } from "../../../src/drafts/adapters/memory/in-memory-drafts";
import { OnOrderDeletedUseCase } from "../../../src/drafts/application/on-order-deleted";
import { Draft } from "../../../src/drafts/domain/draft";
import type { LogEntry, NewLogEntry } from "../../../src/drafts/domain/log-entry";
import type { UnitOfWork } from "../../../src/drafts/ports/outbound";
import type { ChatId } from "../../../src/shared/chat-id";
import type { OwnerLease } from "../../../src/shared/owner-lease";
import { FakeClock } from "../../support/fake-clock";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";
import { closeSqliteUnitsOfWork, sqliteUnitOfWork } from "../contract/sqlite-unit-of-work";

afterEach(closeSqliteUnitsOfWork);

const chat = "chat-a" as ChatId;
const subjects: [string, (lease: OwnerLease) => UnitOfWork][] = [
  ["in memory", (lease) => new InMemoryDrafts(lease).unitOfWork],
  ["SQLite", sqliteUnitOfWork],
];

const entry = (over: Partial<NewLogEntry>): NewLogEntry => ({
  at: 1_000, kind: "proposed", draft: 1, draftKind: "order", chat, proposedText: null, finalText: null, reason: null, ownerWords: null,
  approvalEntryId: null, sendId: null, orderRef: null, ...over,
});

/** Draft 1 is an order that was approved and recorded as o-1; draft 2 is a reply with an approval; o-2 is another order. */
async function seed(uow: UnitOfWork) {
  const mk = (number: number, kind: "reply" | "order", text: string, chatId: ChatId) => {
    const r = Draft.propose({
      number, kind, chat: chatId, text, now: 1_000, dev: false, answers: null,
      basis: { messageId: { provider: "dev", providerMessageId: "m1" }, sentAt: 900 }, checkedStoredAt: 950, orderPayload: kind === "order" ? '{"items":["cake"]}' : null,
    });
    if (!("draft" in r)) throw new Error("fixture refused");
    return r.draft;
  };
  await uow.run(async (tx) => {
    for (let n = 0; n < 3; n++) await tx.drafts.nextNumber();
    await tx.drafts.save(mk(1, "order", "2 cakes for Ana Garcia", chat));
    await tx.drafts.save(mk(2, "reply", "reply text", "chat-b" as ChatId));
    await tx.drafts.save(mk(3, "order", "another order", "chat-c" as ChatId));
    for (const n of [1, 2, 3]) {
      await tx.approvals.insert({
        id: `ap${n}`, draftNumber: n, textVersion: 1, text: `approved text ${n}`, textHash: `hash${n}`, ownerWords: `go on ${n}`,
        approvedAt: 2_000, usedAt: 2_000, sendId: `deputy:ap${n}`, voidedAt: null, voidReason: null,
      });
    }
    await tx.log.append([
      entry({ kind: "approved", ownerWords: "go on 1", sendId: "deputy:ap1" }),
      entry({ kind: "recorded", orderRef: "o-1" }),
      entry({ kind: "order_command", draft: null, draftKind: null, orderRef: "o-1", ownerWords: "mark o-1 ready", reason: "changed: status" }),
      entry({ kind: "order_command", draft: null, draftKind: null, orderRef: "o-2", ownerWords: "mark o-2 ready", reason: "changed: status" }),
      entry({ kind: "approved", draft: 2, draftKind: "reply", chat: "chat-b" as ChatId, proposedText: "reply text", finalText: "reply text", ownerWords: "go on 2" }),
      entry({ kind: "approved", draft: 3, ownerWords: "go on 3" }),
    ]);
  });
}

const event = (over: Partial<Parameters<OnOrderDeletedUseCase["run"]>[0]> = {}) => ({ eventId: "ev-1", orderId: "o-1", draftNumber: 1, chat: "chat-a", ...over });
const logOf = (uow: UnitOfWork): Promise<LogEntry[]> => uow.run((tx) => tx.log.page({ after: 0, limit: 100 }), { requireLease: false });

describe.each(subjects)("OnOrderDeleted on %s (FR-DRAFTS-04-10)", (_name, make) => {
  const setup = async () => {
    const holder: LeaseHolder = { token: "me", heartbeat: 1 };
    const lease = new InMemoryOwnerLease(holder, new FakeClock(1), "me");
    const uow = make(lease);
    await seed(uow);
    const useCase = new OnOrderDeletedUseCase({ clock: new FakeClock(5_000), lease, unitOfWork: uow });
    return { uow, holder, useCase };
  };

  test("the order's log entries, draft row and approvals are scrubbed column by column; the references and rows stay", async () => {
    const { uow, useCase } = await setup();
    expect(await useCase.run(event())).toEqual({ scrubbed: 3 });
    const log = await logOf(uow);
    const order = log.filter((e) => e.draft === 1 || e.orderRef === "o-1");
    for (const e of order.filter((x) => x.kind !== "order_deleted")) expect(e.scrubbed).toBe(true);
    expect(log.find((e) => e.kind === "approved" && e.draft === 1)).toMatchObject({ ownerWords: "deleted", sendId: "deputy:ap1", scrubbed: true });
    expect(log.find((e) => e.kind === "recorded")).toMatchObject({ orderRef: "o-1", ownerWords: null, scrubbed: true });
    const draft = (await uow.run((tx) => tx.drafts.get(1), { requireLease: false }))?.snapshot();
    expect(draft).toMatchObject({
      number: 1, kind: "order", currentText: "deleted", proposedText: "deleted", currentNorm: "deleted", proposedNorm: "deleted", orderPayload: null,
    });
    const [approval] = await uow.run((tx) => tx.approvals.forDraft(1), { requireLease: false });
    expect(approval).toMatchObject({ id: "ap1", draftNumber: 1, text: "deleted", ownerWords: "deleted", textHash: "deleted", sendId: "deputy:ap1" });
    expect(log.filter((e) => e.kind === "order_deleted")).toMatchObject([{ orderRef: "o-1", chat: "chat-a", scrubbed: false }]);
  });

  test("order_command entries of the order are scrubbed too; other orders and reply drafts are untouched", async () => {
    const { uow, useCase } = await setup();
    await useCase.run(event());
    const log = await logOf(uow);
    expect(log.find((e) => e.kind === "order_command" && e.orderRef === "o-1")).toMatchObject({ scrubbed: true, ownerWords: "deleted" });
    expect(log.find((e) => e.kind === "order_command" && e.orderRef === "o-2")).toMatchObject({ scrubbed: false, ownerWords: "mark o-2 ready" });
    expect(log.find((e) => e.draft === 3)).toMatchObject({ scrubbed: false, ownerWords: "go on 3" });
    expect(log.find((e) => e.draft === 2)).toMatchObject({ scrubbed: false, ownerWords: "go on 2" });
    for (const n of [2, 3]) {
      const d = (await uow.run((tx) => tx.drafts.get(n), { requireLease: false }))?.snapshot();
      expect(d?.currentText).not.toBe("deleted");
      expect((await uow.run((tx) => tx.approvals.forDraft(n), { requireLease: false }))[0]?.ownerWords).toBe(`go on ${n}`);
    }
  });

  test("the event delivered twice scrubs once: the second run returns 0 and one order_deleted entry exists", async () => {
    const { uow, useCase } = await setup();
    expect(await useCase.run(event())).toEqual({ scrubbed: 3 });
    expect(await useCase.run(event())).toEqual({ scrubbed: 0 });
    expect((await logOf(uow)).filter((e) => e.kind === "order_deleted")).toHaveLength(1);
  });

  test("a null draftNumber (an order of another folder) changes no draft or approval row", async () => {
    const { uow, useCase } = await setup();
    await useCase.run(event({ draftNumber: null, orderId: "o-9" }));
    for (const n of [1, 2, 3]) {
      expect((await uow.run((tx) => tx.drafts.get(n), { requireLease: false }))?.snapshot().currentText).not.toBe("deleted");
      expect((await uow.run((tx) => tx.approvals.forDraft(n), { requireLease: false }))[0]?.ownerWords).toBe(`go on ${n}`);
    }
    expect((await logOf(uow)).filter((e) => e.kind === "order_deleted")).toMatchObject([{ orderRef: "o-9" }]);
  });

  test("a draft number that belongs to a reply draft changes neither the draft nor its approval", async () => {
    const { uow, useCase } = await setup();
    await useCase.run(event({ orderId: "o-7", draftNumber: 2 }));
    expect((await uow.run((tx) => tx.drafts.get(2), { requireLease: false }))?.snapshot()).toMatchObject({ currentText: "reply text", proposedText: "reply text" });
    expect((await uow.run((tx) => tx.approvals.forDraft(2), { requireLease: false }))[0]).toMatchObject({ text: "approved text 2", ownerWords: "go on 2", textHash: "hash2" });
  });

  test("a process that is not the owner refuses and changes nothing, so the outbox delivers again to the owner", async () => {
    const { uow, holder, useCase } = await setup();
    holder.token = "other";
    expect(await useCase.run(event())).toEqual({ refused: "not_owner" });
    holder.token = "me";
    expect((await logOf(uow)).some((e) => e.scrubbed || e.kind === "order_deleted")).toBe(false);
    expect(await useCase.run(event())).toEqual({ scrubbed: 3 });
  });
});

describe.each(subjects)("a restart between the order delete and the scrub on %s (FR-DRAFTS-04-10)", (_name, make) => {
  test("the event was never handled; delivered again at restart, the scrub completes once", async () => {
    const holder: LeaseHolder = { token: "me", heartbeat: 1 };
    const lease = new InMemoryOwnerLease(holder, new FakeClock(1), "me");
    const uow = make(lease);
    await seed(uow);
    // the process was killed before OnOrderDeleted ran: nothing is scrubbed yet
    expect((await logOf(uow)).some((e) => e.scrubbed)).toBe(false);
    const afterRestart = new OnOrderDeletedUseCase({ clock: new FakeClock(9_000), lease, unitOfWork: uow });
    expect(await afterRestart.run(event())).toEqual({ scrubbed: 3 });
    expect(await afterRestart.run(event())).toEqual({ scrubbed: 0 });
    expect((await logOf(uow)).filter((e) => e.kind === "order_deleted")).toHaveLength(1);
  });
});
