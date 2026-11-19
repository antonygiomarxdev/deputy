import { num, str } from "../../../adapters/sqlite/row";
import type { ChatId } from "../../../shared/chat-id";
import type { SqlExecutor, SqlValue } from "../../../shared/sql-database";
import { LogUnavailable } from "../../domain/errors";
import type { LogEntry, NewLogEntry } from "../../domain/log-entry";
import { toIso } from "../../domain/time";
import type { DraftLogRepository } from "../../ports/log";
import { fromRow } from "./draft-log-row";

const COLUMNS =
  "at, kind, draft_number, draft_kind, chat, proposed_text, final_text, reason, owner_words, approval_entry_id, send_id, order_ref";
const ROW = `(${COLUMNS.split(",").map(() => "?").join(", ")})`;

export class SqliteDraftLogRepository implements DraftLogRepository {
  constructor(private readonly db: SqlExecutor) {}

  /** One INSERT statement, so a refused entry stores nothing of the batch. */
  async append(entries: NewLogEntry[]): Promise<number[]> {
    if (entries.length === 0) return [];
    const params: SqlValue[] = entries.flatMap((e) => [
      toIso(e.at), e.kind, e.draft, e.draftKind, e.chat, e.proposedText, e.finalText, e.reason, e.ownerWords,
      e.approvalEntryId, e.sendId, e.orderRef,
    ]);
    try {
      const rows = await this.db.query(
        `INSERT INTO drafts_log (${COLUMNS}) VALUES ${entries.map(() => ROW).join(", ")} RETURNING id`,
        params,
      );
      return rows.map((r) => num(r, "id"));
    } catch (e) {
      throw new LogUnavailable(e);
    }
  }

  async page(f: { chat?: ChatId; before?: number; after?: number; limit: number }): Promise<LogEntry[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (f.chat !== undefined) {
      where.push("chat = ?");
      params.push(f.chat);
    }
    const ascending = f.after !== undefined;
    if (f.after !== undefined) {
      where.push("id > ?");
      params.push(f.after);
    } else if (f.before !== undefined) {
      where.push("id < ?");
      params.push(f.before);
    }
    const rows = await this.db.query(
      `SELECT * FROM drafts_log${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY id ${ascending ? "ASC" : "DESC"} LIMIT ?`,
      [...params, f.limit],
    );
    return rows.map(fromRow);
  }

  /** Every `sent` entry with the `approved` entry it points to, in one query: the approval rows are fetched by the same statement. */
  async sentWithApproval(): Promise<{ sent: LogEntry; approval: LogEntry | null }[]> {
    const rows = (
      await this.db.query(
        `SELECT * FROM drafts_log
          WHERE kind = 'sent'
             OR id IN (SELECT approval_entry_id FROM drafts_log WHERE kind = 'sent' AND approval_entry_id IS NOT NULL)
          ORDER BY id`,
      )
    ).map(fromRow);
    const byId = new Map(rows.map((e) => [e.id, e]));
    return rows
      .filter((e) => e.kind === "sent")
      .map((sent) => ({ sent, approval: sent.approvalEntryId === null ? null : (byId.get(sent.approvalEntryId) ?? null) }));
  }

  /** Reply drafts in "sending" or "unknown" with no `sent` entry; `since` is the time of the latest `sending` entry. */
  async stuckDrafts(): Promise<{ draft: number; chat: string; state: "sending" | "unknown"; since: string }[]> {
    const rows = await this.db.query(
      `SELECT d.number, d.chat, d.state,
              COALESCE((SELECT MAX(l.at) FROM drafts_log l WHERE l.draft_number = d.number AND l.kind = 'sending'), d.made_at) AS since
         FROM drafts d
        WHERE d.kind = 'reply' AND d.state IN ('sending','unknown')
          AND NOT EXISTS (SELECT 1 FROM drafts_log l WHERE l.draft_number = d.number AND l.kind = 'sent')
        ORDER BY d.number`,
    );
    return rows.map((r) => {
      const state = str(r, "state");
      if (state !== "sending" && state !== "unknown") throw new Error(`stuck draft state '${state}'`);
      return { draft: num(r, "number"), chat: str(r, "chat"), state, since: str(r, "since") };
    });
  }

  async scrubOrder(orderId: string, draftNumber: number | null): Promise<number> {
    const { changes } = await this.db.run(
      `UPDATE drafts_log
          SET scrubbed = 1, owner_words = CASE WHEN owner_words IS NULL THEN NULL ELSE 'deleted' END
        WHERE scrubbed = 0
          AND (draft_kind = 'order' OR kind IN ('order_command','order_deleted'))
          AND (order_ref = ? OR (? IS NOT NULL AND draft_number = ?))`,
      [orderId, draftNumber, draftNumber],
    );
    return changes;
  }

  async approvalEntryIdFor(sendId: string): Promise<number | null> {
    const [r] = await this.db.query("SELECT id FROM drafts_log WHERE kind = 'approved' AND send_id = ? ORDER BY id LIMIT 1", [sendId]);
    return r ? num(r, "id") : null;
  }

  async hasOrderDeleted(orderRef: string): Promise<boolean> {
    const [r] = await this.db.query("SELECT 1 AS found FROM drafts_log WHERE kind = 'order_deleted' AND order_ref = ? LIMIT 1", [orderRef]);
    return r !== undefined;
  }
}
