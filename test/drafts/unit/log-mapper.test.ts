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
    { ...base, type: "ApprovalVoided", reason: "changed", approvalId: "ap1" },
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
