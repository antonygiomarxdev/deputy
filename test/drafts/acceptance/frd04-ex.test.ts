import { describe, expect, test } from "bun:test";
import { InMemoryDrafts } from "../../../src/drafts/adapters/memory/in-memory-drafts";
import { OnOrderDeletedUseCase } from "../../../src/drafts/application/on-order-deleted";
import { Draft } from "../../../src/drafts/domain/draft";
import type { LogEntry, NewLogEntry } from "../../../src/drafts/domain/log-entry";
import type { ChatId } from "../../../src/shared/chat-id";
import { FakeClock } from "../../support/fake-clock";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";
import { makeDrafts, message } from "./harness";

const chats = {
  "chat-a": [message("a1", "customer", "How much is the cake?", 900)],
  "chat-b": [message("b1", "customer", "Do you deliver?", 910)],
  "chat-c": [message("c1", "customer", "Are you open?", 920)],
};
const chat = "chat-a" as ChatId;
const raw = (over: Partial<NewLogEntry>): NewLogEntry => ({
  at: 1_000, kind: "proposed", draft: 1, draftKind: "reply", chat, proposedText: "t", finalText: "t", reason: null,
  ownerWords: null, approvalEntryId: null, sendId: null, orderRef: null, ...over,
});

async function sentDraft(h: ReturnType<typeof makeDrafts>, chatId: string, text: string, words: string) {
  const created = await h.createDraft.run({ kind: "reply", chat: chatId, text });
  if (!created.ok) throw new Error("create refused");
  await h.listDrafts.run({});
  await h.approveDraft.run({ number: created.value.number, shownText: text, ownerWords: words });
}
const logOf = (h: { store: InMemoryDrafts }): Promise<LogEntry[]> => h.store.unitOfWork.run((tx) => tx.log.page({ after: 0, limit: 100 }), { requireLease: false });

describe("Drafts FRD-04 examples: the approval check", () => {
  test("covers: drafts/FRD-04/EX-7 three sent messages: each sent entry points to one earlier approval entry holding the owner's words", async () => {
    const h = makeDrafts({ chats });
    await sentDraft(h, "chat-a", "ten", "go 1");
    await sentDraft(h, "chat-b", "yes", "go 2");
    await sentDraft(h, "chat-c", "nine", "go 3");
    const log = await logOf(h);
    const sent = log.filter((e) => e.kind === "sent");
    expect(sent).toHaveLength(3);
    const pointed = new Set<number>();
    for (const s of sent) {
      const approval = log.find((e) => e.id === s.approvalEntryId);
      expect(approval?.kind).toBe("approved");
      expect(approval?.draft).toBe(s.draft);
      expect(approval!.id).toBeLessThan(s.id);
      expect(approval?.ownerWords).toBe(`go ${s.draft}`);
      pointed.add(approval!.id);
    }
    expect(pointed.size).toBe(3);
    expect(await h.checkApprovals.run()).toEqual({ defects: [], gaps: [] });
  });

  test("covers: drafts/FRD-04/EX-8 a sent entry whose text differs from the approved text is reported as a defect", async () => {
    const h = makeDrafts({ chats });
    const [approvalId] = await h.store.log.append([raw({ kind: "approved", finalText: "ten", ownerWords: "go 1" })]);
    const [sentId] = await h.store.log.append([raw({ at: 1_001, kind: "sent", finalText: "eleven", approvalEntryId: approvalId as number, sendId: "deputy:x" })]);
    expect((await h.checkApprovals.run()).defects).toEqual([{ entryId: sentId as number, draft: 1, chat: "chat-a", problem: "text_differs" }]);
  });
});

/** Draft 1 is an order approved and recorded as o-1, with the customer's name in its texts. */
async function orderWithEntries() {
  const holder: LeaseHolder = { token: "me", heartbeat: 1 };
  const lease = new InMemoryOwnerLease(holder, new FakeClock(1), "me");
  const store = new InMemoryDrafts(lease);
  const r = Draft.propose({
    number: 1, kind: "order", chat, text: "2 cakes for Ana Garcia", now: 1_000, dev: false, answers: null,
    basis: { messageId: { provider: "dev", providerMessageId: "m1" }, sentAt: 900 }, checkedStoredAt: 950, orderPayload: '{"items":["cake"]}',
  });
  if (!("draft" in r)) throw new Error("fixture refused");
  await store.unitOfWork.run(async (tx) => {
    await tx.drafts.nextNumber();
    await tx.drafts.save(r.draft);
    await tx.approvals.insert({
      id: "ap1", draftNumber: 1, textVersion: 1, text: "2 cakes for Ana Garcia", textHash: "hash1", ownerWords: "go on 1",
      approvedAt: 2_000, usedAt: 2_000, sendId: "deputy:ap1", voidedAt: null, voidReason: null,
    });
    await tx.log.append([
      raw({ kind: "approved", draftKind: "order", proposedText: null, finalText: null, ownerWords: "go on 1", sendId: "deputy:ap1" }),
      raw({ kind: "recorded", draftKind: "order", proposedText: null, finalText: null, orderRef: "o-1" }),
    ]);
  });
  const useCase = new OnOrderDeletedUseCase({ clock: new FakeClock(5_000), lease, unitOfWork: store.unitOfWork });
  return { store, useCase };
}
const deleted = { eventId: "ev-1", orderId: "o-1", draftNumber: 1, chat: "chat-a" };

describe("Drafts FRD-04 examples: deleting an order", () => {
  test("covers: drafts/FRD-04/EX-19 an order with log entries is deleted: entries show deleted, the owner's words read deleted, no personal data remains", async () => {
    const { store, useCase } = await orderWithEntries();
    await useCase.run(deleted);
    const log = await logOf({ store });
    const own = log.filter((e) => e.kind !== "order_deleted");
    expect(own).toHaveLength(2);
    for (const e of own) {
      expect(e.scrubbed).toBe(true);
      expect(JSON.stringify(e)).not.toContain("Ana Garcia");
    }
    expect(log.find((e) => e.kind === "approved")?.ownerWords).toBe("deleted");
    const draft = (await store.unitOfWork.run((tx) => tx.drafts.get(1), { requireLease: false }))?.snapshot();
    expect(JSON.stringify(draft)).not.toContain("Ana Garcia");
    const [approval] = await store.unitOfWork.run((tx) => tx.approvals.forDraft(1), { requireLease: false });
    expect(JSON.stringify(approval)).not.toContain("Ana Garcia");
  });

  test("covers: drafts/FRD-04/EX-20 a deleted order: the reference and the fact of approval remain", async () => {
    const { store, useCase } = await orderWithEntries();
    await useCase.run(deleted);
    const log = await logOf({ store });
    expect(log.find((e) => e.kind === "recorded")?.orderRef).toBe("o-1");
    expect(log.find((e) => e.kind === "approved")).toMatchObject({ draft: 1, sendId: "deputy:ap1" });
    expect(log.find((e) => e.kind === "order_deleted")?.orderRef).toBe("o-1");
    const [approval] = await store.unitOfWork.run((tx) => tx.approvals.forDraft(1), { requireLease: false });
    expect(approval).toMatchObject({ id: "ap1", draftNumber: 1, sendId: "deputy:ap1" });
  });
});
