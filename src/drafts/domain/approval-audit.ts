import type { LogEntry } from "./log-entry";

export type AuditDefect = {
  entryId: number;
  draft: number | null; // a `sent` entry of a draft always has one; the column is nullable for order entries
  chat: string;
  problem: "no_approval" | "wrong_approval" | "approval_after_sent" | "text_differs" | "approval_shared";
};
export type AuditGap = { draft: number; chat: string; state: "sending" | "unknown"; since: string };

type Row = { sent: LogEntry; approval: LogEntry | null };

function problemOf(row: Row, pointedAt: ReadonlyMap<number, number>): AuditDefect["problem"] | null {
  const { sent, approval } = row;
  if (approval === null) return "no_approval";
  if (approval.kind !== "approved" || approval.draft !== sent.draft) return "wrong_approval";
  if (approval.id >= sent.id) return "approval_after_sent";
  if (approval.finalText !== sent.finalText) return "text_differs";
  if ((pointedAt.get(approval.id) ?? 0) > 1) return "approval_shared";
  return null;
}

export const ApprovalAudit = {
  /**
   * no_approval: no pointer or no such entry. wrong_approval: the entry is not `approved` or belongs to another draft.
   * approval_after_sent: the approval's id is not lower than the sent entry's id. text_differs: finalText differs.
   * approval_shared: two sent entries point to one approval. One defect per sent entry, the first that applies.
   */
  audit(rows: readonly Row[], stuck: readonly AuditGap[]): { defects: AuditDefect[]; gaps: AuditGap[] } {
    const pointedAt = new Map<number, number>();
    for (const { approval } of rows) if (approval) pointedAt.set(approval.id, (pointedAt.get(approval.id) ?? 0) + 1);
    const defects = rows.flatMap((row): AuditDefect[] => {
      const problem = problemOf(row, pointedAt);
      return problem === null ? [] : [{ entryId: row.sent.id, draft: row.sent.draft, chat: row.sent.chat, problem }];
    });
    return { defects, gaps: [...stuck] };
  },
};
