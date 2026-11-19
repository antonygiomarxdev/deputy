import { describe, expect, test } from "bun:test";
import type { NewLogEntry } from "../../../src/drafts/domain/log-entry";
import type { DraftLogRepository } from "../../../src/drafts/ports/log";
import { LogUnavailable } from "../../../src/drafts/domain/errors";
import type { ChatId } from "../../../src/shared/chat-id";

const chatA = "chat-a" as ChatId;
const chatB = "chat-b" as ChatId;

export const entry = (over: Partial<NewLogEntry> = {}): NewLogEntry => ({
  at: 1000,
  kind: "proposed",
  draft: 1,
  draftKind: "reply",
  chat: chatA,
  proposedText: "p",
  finalText: "p",
  reason: null,
  ownerWords: null,
  approvalEntryId: null,
  sendId: null,
  orderRef: null,
  ...over,
});

export function draftLogRepositoryContract(name: string, make: () => DraftLogRepository): void {
  describe(`DraftLogRepository: ${name}`, () => {
    test("FR-DRAFTS-04-3: append returns ids in order, rising by one", async () => {
      const log = make();
      const first = await log.append([entry(), entry({ kind: "rejected" })]);
      const second = await log.append([entry()]);
      expect(first[1]).toBe((first[0] as number) + 1);
      expect(second[0]).toBe((first[1] as number) + 1);
    });

    test("FR-DRAFTS-04-3: page after is oldest first above the id; before is newest first below it; limit bounds", async () => {
      const log = make();
      const ids = await log.append([1, 2, 3, 4, 5].map((n) => entry({ at: n })));
      const after = await log.page({ after: ids[1] as number, limit: 2 });
      expect(after.map((e) => e.id)).toEqual([ids[2], ids[3]] as number[]);
      const before = await log.page({ before: ids[3] as number, limit: 10 });
      expect(before.map((e) => e.id)).toEqual([ids[2], ids[1], ids[0]] as number[]);
      const newest = await log.page({ limit: 2 });
      expect(newest.map((e) => e.id)).toEqual([ids[4], ids[3]] as number[]);
    });

    test("FR-DRAFTS-04-1: entries of the same second come back in id order", async () => {
      const log = make();
      const ids = await log.append([entry({ at: 5 }), entry({ at: 5 }), entry({ at: 5 })]);
      const page = await log.page({ after: 0, limit: 10 });
      expect(page.map((e) => e.id)).toEqual(ids);
    });

    test("FR-DRAFTS-04-6: page by chat returns only that chat", async () => {
      const log = make();
      await log.append([entry(), entry({ chat: chatB, draft: 2 }), entry()]);
      const page = await log.page({ chat: chatB, limit: 10 });
      expect(page.map((e) => e.chat)).toEqual([chatB]);
    });

    test("FR-DRAFTS-04-9: an order draft entry with text is refused and nothing of the batch is stored", async () => {
      const log = make();
      const bad = entry({ draftKind: "order", proposedText: "x" });
      await expect(log.append([entry(), bad])).rejects.toBeInstanceOf(LogUnavailable);
      expect(await log.page({ limit: 10 })).toEqual([]);
    });

    test("FR-DRAFTS-04-9: an entry with neither a draft number nor an order reference is refused", async () => {
      const log = make();
      await expect(log.append([entry({ draft: null, draftKind: null })])).rejects.toBeInstanceOf(LogUnavailable);
    });

    test("approvalEntryIdFor and sentWithApproval follow the pointer", async () => {
      const log = make();
      const [approved] = await log.append([entry({ kind: "approved", sendId: "s1" })]);
      expect(await log.approvalEntryIdFor("s1")).toBe(approved as number);
      expect(await log.approvalEntryIdFor("nope")).toBeNull();
      await log.append([entry({ kind: "sent", sendId: "s1", approvalEntryId: approved as number })]);
      const rows = await log.sentWithApproval();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.approval?.id).toBe(approved as number);
    });

    test("approvalEntryIdFor returns the earliest approved entry of a send id", async () => {
      const log = make();
      const [first] = await log.append([entry({ kind: "approved", sendId: "s1" }), entry({ kind: "approved", sendId: "s1" })]);
      expect(await log.approvalEntryIdFor("s1")).toBe(first as number);
    });

    test("sentWithApproval returns the sent entries in id order", async () => {
      const log = make();
      const [a1] = await log.append([entry({ kind: "approved", sendId: "s1" })]);
      const [a2] = await log.append([entry({ kind: "approved", sendId: "s2" })]);
      await log.append([
        entry({ kind: "sent", sendId: "s2", approvalEntryId: a2 as number }),
        entry({ kind: "sent", sendId: "s1", approvalEntryId: a1 as number }),
      ]);
      expect((await log.sentWithApproval()).map((r) => r.sent.sendId)).toEqual(["s2", "s1"]);
    });

    test("sentWithApproval keeps a sent entry that has no pointer, with no approval", async () => {
      const log = make();
      await log.append([entry({ kind: "sent", sendId: "s1", approvalEntryId: null }), entry({ kind: "proposed", draft: 2 })]);
      const rows = await log.sentWithApproval();
      expect(rows.map((r) => [r.sent.draft, r.approval])).toEqual([[1, null]]);
    });

    test("scrubOrder is the one update path: it marks order entries and is counted once", async () => {
      const log = make();
      await log.append([
        entry({ draft: 7, draftKind: "order", proposedText: null, finalText: null, ownerWords: "go 7" }),
        entry({ draft: 8 }),
        entry({ kind: "order_command", draft: null, draftKind: null, orderRef: "o1", ownerWords: "cancel", proposedText: null, finalText: null }),
      ]);
      expect(await log.scrubOrder("o1", 7)).toBe(2);
      expect(await log.scrubOrder("o1", 7)).toBe(0);
      const all = await log.page({ after: 0, limit: 10 });
      expect(all.map((e) => e.scrubbed)).toEqual([true, false, true]);
      expect(all[0]?.ownerWords).toBe("deleted");
    });

    test("hasOrderDeleted sees an order_deleted entry", async () => {
      const log = make();
      expect(await log.hasOrderDeleted("o1")).toBe(false);
      await log.append([entry({ kind: "order_deleted", draft: null, draftKind: null, orderRef: "o1", proposedText: null, finalText: null })]);
      expect(await log.hasOrderDeleted("o1")).toBe(true);
    });
  });
}
