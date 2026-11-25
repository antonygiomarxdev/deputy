// covers: drafts/FRD-04/EX-1
// covers: drafts/FRD-04/EX-2
// covers: drafts/FRD-04/EX-3
// covers: drafts/FRD-04/EX-4
// covers: drafts/FRD-04/EX-17
// covers: drafts/FRD-04/EX-18
import { expect, test } from "bun:test";
import type { DraftEvent } from "../../../src/drafts/domain/events";
import { toLogEntries } from "../../../src/drafts/domain/log-mapper";
import type { ChatId } from "../../../src/shared/chat-id";

const chat = "chat-a" as ChatId;
const base = { draft: 4, draftKind: "reply" as const, chat, at: 1000 };

test("FR-DRAFTS-04-1: one entry per event, in order, naming the draft and the chat", () => {
  const events: DraftEvent[] = [
    { ...base, type: "DraftProposed", text: "Hello", answersMessageId: "dev:m1" },
    { ...base, type: "DraftReplaced", replacedBy: 5 },
    { ...base, type: "TextChanged", proposedText: "Hello", newText: "Hi", ownerWords: "change 4" },
    { ...base, type: "DraftRejected", ownerWords: "no 4" },
    { ...base, type: "ApprovalVoided", reason: "changed", approvalId: "ap1", sendId: "deputy:ap1" },
  ];
  const entries = toLogEntries(events, { approvalEntryId: 9 });
  expect(entries.map((e) => e.kind)).toEqual(["proposed", "replaced", "text_changed", "rejected", "approval_voided"]);
  for (const e of entries) expect(e).toMatchObject({ draft: 4, draftKind: "reply", chat, at: 1000 });
  expect(entries[0]).toMatchObject({ proposedText: "Hello", finalText: "Hello", ownerWords: null, reason: null });
  expect(entries[1]).toMatchObject({ reason: "replaced by 5", proposedText: null, finalText: null });
  expect(entries[3]).toMatchObject({ ownerWords: "no 4" });
  expect(entries[4]).toMatchObject({ reason: "changed", approvalEntryId: 9 });
});

test("FR-DRAFTS-04-2: text_changed holds the original proposed text and the new final text", () => {
  const [e] = toLogEntries(
    [{ ...base, type: "TextChanged", proposedText: "Original", newText: "Final", ownerWords: "change 4" }],
    { approvalEntryId: null },
  );
  expect(e).toMatchObject({ kind: "text_changed", proposedText: "Original", finalText: "Final", ownerWords: "change 4" });
});

test("FR-DRAFTS-04-9: an order draft entry carries no text", () => {
  const order = { ...base, draftKind: "order" as const };
  const entries = toLogEntries(
    [
      { ...order, type: "DraftProposed", text: "2 cakes", answersMessageId: null },
      { ...order, type: "TextChanged", proposedText: "2 cakes", newText: "3 cakes", ownerWords: "w" },
    ],
    { approvalEntryId: null },
  );
  for (const e of entries) expect(e).toMatchObject({ proposedText: null, finalText: null, draftKind: "order" });
});

test("FR-DRAFTS-04-1: the SPEC-02 events map to approved, sending, sent, failed, unknown and recorded entries", () => {
  const entries = toLogEntries(
    [
      { ...base, type: "Approved", approvalId: "ap1", sendId: "deputy:ap1", proposedText: "Hello", text: "Hello!", ownerWords: "go 4" },
      { ...base, type: "SendStarted", sendId: "deputy:ap1", text: "Hello!" },
      { ...base, type: "DraftSent", sendId: "deputy:ap1", text: "Hello!", reason: "found_after_unknown" },
      { ...base, type: "SendFailed", reason: "quota" },
      { ...base, type: "OutcomeUnknown", reason: "unknown_outcome" },
      { ...base, type: "OrderRecorded", orderId: "o-1" },
    ],
    { approvalEntryId: 9 },
  );
  expect(entries.map((e) => e.kind)).toEqual(["approved", "sending", "sent", "failed", "unknown", "recorded"]);
  expect(entries[0]).toMatchObject({ proposedText: "Hello", finalText: "Hello!", ownerWords: "go 4", sendId: "deputy:ap1", approvalEntryId: null });
  expect(entries[1]).toMatchObject({ proposedText: null, finalText: "Hello!", sendId: "deputy:ap1", approvalEntryId: 9 });
  expect(entries[2]).toMatchObject({ finalText: "Hello!", sendId: "deputy:ap1", reason: "found_after_unknown", approvalEntryId: 9 });
  expect(entries[3]).toMatchObject({ reason: "quota", approvalEntryId: 9 });
  expect(entries[4]).toMatchObject({ reason: "unknown_outcome", approvalEntryId: 9 });
  expect(entries[5]).toMatchObject({ orderRef: "o-1", approvalEntryId: 9 });
});

test("FR-DRAFTS-04-9: every SPEC-02 event of an order draft carries no text", () => {
  const order = { ...base, draftKind: "order" as const };
  const entries = toLogEntries(
    [
      { ...order, type: "Approved", approvalId: "ap1", sendId: "deputy:ap1", proposedText: "2 cakes", text: "3 cakes", ownerWords: "go 4" },
      { ...order, type: "SendStarted", sendId: "deputy:ap1", text: "3 cakes" },
      { ...order, type: "DraftSent", sendId: "deputy:ap1", text: "3 cakes", reason: null },
      { ...order, type: "SendFailed", reason: "quota" },
      { ...order, type: "OutcomeUnknown", reason: "order_outcome_unknown" },
      { ...order, type: "OrderRecorded", orderId: "o-1" },
    ],
    { approvalEntryId: 9 },
  );
  expect(entries.map((e) => e.kind)).toEqual(["approved", "sending", "sent", "failed", "unknown", "recorded"]);
  for (const e of entries) expect(e).toMatchObject({ draftKind: "order", proposedText: null, finalText: null });
});
