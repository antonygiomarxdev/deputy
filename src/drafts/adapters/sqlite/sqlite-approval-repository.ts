import { num, str, strOrNull } from "../../../adapters/sqlite/row";
import type { Instant } from "../../../shared/instant";
import type { SqlExecutor, SqlRow } from "../../../shared/sql-database";
import type { Approval } from "../../domain/approval";
import type { DraftNumber } from "../../domain/draft";
import { fromIso, toIso } from "../../domain/time";
import type { ApprovalRepository } from "../../ports/store";

const timeOrNull = (r: SqlRow, c: string): Instant | null => {
  const v = strOrNull(r, c);
  return v === null ? null : fromIso(v);
};

function toApproval(r: SqlRow): Approval {
  return {
    id: str(r, "id"),
    draftNumber: num(r, "draft_number"),
    textVersion: num(r, "text_version"),
    text: str(r, "text"),
    textHash: str(r, "text_hash"),
    ownerWords: str(r, "owner_words"),
    approvedAt: fromIso(str(r, "approved_at")),
    usedAt: timeOrNull(r, "used_at"),
    sendId: str(r, "send_id"),
    voidedAt: timeOrNull(r, "voided_at"),
    voidReason: strOrNull(r, "void_reason"),
  };
}

export class SqliteApprovalRepository implements ApprovalRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(a: Approval): Promise<void> {
    // used_at is NOT NULL: an approval is born used
    await this.db.run(
      "INSERT INTO approvals (id, draft_number, text_version, text, text_hash, owner_words, approved_at, used_at, send_id, voided_at, void_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        a.id, a.draftNumber, a.textVersion, a.text, a.textHash, a.ownerWords, toIso(a.approvedAt),
        a.usedAt === null ? null : toIso(a.usedAt), a.sendId, a.voidedAt === null ? null : toIso(a.voidedAt), a.voidReason,
      ],
    );
  }

  async void(draft: DraftNumber, reason: string, at: Instant): Promise<void> {
    await this.db.run("UPDATE approvals SET voided_at = ?, void_reason = ? WHERE draft_number = ? AND voided_at IS NULL", [
      toIso(at), reason, draft,
    ]);
  }

  async scrubOrderDraft(draft: DraftNumber): Promise<void> {
    await this.db.run(
      "UPDATE approvals SET text = 'deleted', owner_words = 'deleted', text_hash = 'deleted' WHERE draft_number = ? AND draft_number IN (SELECT number FROM drafts WHERE kind = 'order')",
      [draft],
    );
  }

  async forDraft(draft: DraftNumber): Promise<Approval[]> {
    return (await this.db.query("SELECT * FROM approvals WHERE draft_number = ? ORDER BY rowid", [draft])).map(toApproval);
  }
}
