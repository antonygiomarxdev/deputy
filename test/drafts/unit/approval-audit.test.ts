import { describe, expect, test } from "bun:test";
import { ApprovalAudit } from "../../../src/drafts/domain/approval-audit";
import type { LogEntry } from "../../../src/drafts/domain/log-entry";
import type { ChatId } from "../../../src/shared/chat-id";

const chat = "chat-a" as ChatId;
const entry = (over: Partial<LogEntry>): LogEntry => ({
  id: 1, at: 1_000, kind: "sent", draft: 1, draftKind: "reply", chat, proposedText: null, finalText: "ten", reason: null,
  ownerWords: null, approvalEntryId: null, sendId: "deputy:ap1", orderRef: null, scrubbed: false, ...over,
});
const approved = (over: Partial<LogEntry> = {}) => entry({ kind: "approved", id: 1, finalText: "ten", ...over });
const sent = (over: Partial<LogEntry> = {}) => entry({ kind: "sent", id: 5, approvalEntryId: 1, ...over });
const audit = (rows: Parameters<typeof ApprovalAudit.audit>[0], stuck: Parameters<typeof ApprovalAudit.audit>[1] = []) => ApprovalAudit.audit(rows, stuck);

describe("FR-DRAFTS-04-5 and -4: ApprovalAudit", () => {
  test("sent messages that each have their approval give no defect and no gap", () => {
    const rows = [1, 2, 3].map((n) => ({
      sent: sent({ id: n * 10 + 5, draft: n, approvalEntryId: n * 10 }),
      approval: approved({ id: n * 10, draft: n }),
    }));
    expect(audit(rows)).toEqual({ defects: [], gaps: [] });
  });

  test("a sent entry with no approval entry is no_approval, with the entry id, draft and chat", () => {
    expect(audit([{ sent: sent({ approvalEntryId: null }), approval: null }]).defects).toEqual([{ entryId: 5, draft: 1, chat, problem: "no_approval" }]);
    expect(audit([{ sent: sent({ approvalEntryId: 77 }), approval: null }]).defects.map((d) => d.problem)).toEqual(["no_approval"]);
  });

  // covers: drafts/FRD-04/EX-8
  test("a final text that differs from the approved text is text_differs", () => {
    expect(audit([{ sent: sent({ finalText: "eleven" }), approval: approved() }]).defects.map((d) => d.problem)).toEqual(["text_differs"]);
  });

  test("a pointer to an entry that is not approved, or belongs to another draft, is wrong_approval", () => {
    expect(audit([{ sent: sent(), approval: approved({ kind: "sending" }) }]).defects.map((d) => d.problem)).toEqual(["wrong_approval"]);
    expect(audit([{ sent: sent(), approval: approved({ draft: 2 }) }]).defects.map((d) => d.problem)).toEqual(["wrong_approval"]);
  });

  test("an approval with an id not lower than the sent entry's is approval_after_sent", () => {
    expect(audit([{ sent: sent({ id: 5, approvalEntryId: 9 }), approval: approved({ id: 9 }) }]).defects.map((d) => d.problem)).toEqual(["approval_after_sent"]);
    expect(audit([{ sent: sent({ id: 5, approvalEntryId: 5 }), approval: approved({ id: 5 }) }]).defects.map((d) => d.problem)).toEqual(["approval_after_sent"]);
  });

  test("two sent entries that point to one approval are approval_shared", () => {
    const a = approved();
    const rows = [
      { sent: sent({ id: 5 }), approval: a },
      { sent: sent({ id: 6 }), approval: a },
    ];
    expect(audit(rows).defects.map((d) => [d.entryId, d.problem])).toEqual([[5, "approval_shared"], [6, "approval_shared"]]);
  });

  test("the stuck drafts come back as the gaps", () => {
    const stuck = [{ draft: 3, chat: "chat-a", state: "sending" as const, since: "2026-01-01T00:00:00.000Z" }];
    expect(audit([], stuck)).toEqual({ defects: [], gaps: stuck });
  });
});
