import { num } from "../../../adapters/sqlite/row";
import type { ChatId } from "../../../shared/chat-id";
import type { SqlExecutor } from "../../../shared/sql-database";
import { Draft, OPEN_STATES, type DraftKind, type DraftNumber } from "../../domain/draft";
import { StaleDraft } from "../../domain/errors";
import type { DraftRepository } from "../../ports/outbound";
import { COLUMNS, fromRow, toValues } from "./draft-row";

const OPEN_LIST = OPEN_STATES.map((s) => `'${s}'`).join(",");
const UPDATABLE = COLUMNS.filter((c) => c !== "number" && c !== "revision");

export class SqliteDraftRepository implements DraftRepository {
  constructor(private readonly db: SqlExecutor) {}

  async nextNumber(): Promise<DraftNumber> {
    const [row] = await this.db.query("UPDATE draft_counter SET last = last + 1 WHERE id = 1 RETURNING last");
    if (!row) throw new Error("draft_counter row is missing");
    return num(row, "last");
  }

  async get(number: DraftNumber): Promise<Draft | null> {
    const [row] = await this.db.query("SELECT * FROM drafts WHERE number = ?", [number]);
    return row ? Draft.rehydrate(fromRow(row)) : null;
  }

  async openFor(chat: ChatId, kind: DraftKind): Promise<Draft | null> {
    const [row] = await this.db.query(`SELECT * FROM drafts WHERE chat = ? AND kind = ? AND state IN (${OPEN_LIST})`, [chat, kind]);
    return row ? Draft.rehydrate(fromRow(row)) : null;
  }

  async listOpen(filter?: { chat?: ChatId }): Promise<Draft[]> {
    const where = filter?.chat === undefined ? "" : " AND chat = ?";
    const rows = await this.db.query(
      `SELECT * FROM drafts WHERE state IN (${OPEN_LIST})${where} ORDER BY number`,
      filter?.chat === undefined ? [] : [filter.chat],
    );
    return rows.map((r) => Draft.rehydrate(fromRow(r)));
  }

  async hasDraftText(normalized: string): Promise<boolean> {
    const [row] = await this.db.query("SELECT 1 AS found FROM drafts WHERE proposed_norm = ? OR current_norm = ? LIMIT 1", [normalized, normalized]);
    return row !== undefined;
  }

  async scrubOrderDraft(number: DraftNumber): Promise<void> {
    await this.db.run(
      "UPDATE drafts SET current_text = 'deleted', proposed_text = 'deleted', current_norm = 'deleted', proposed_norm = 'deleted', order_payload = NULL, revision = revision + 1 WHERE number = ? AND kind = 'order'",
      [number],
    );
  }

  async save(draft: Draft): Promise<void> {
    const s = draft.snapshot();
    const values = toValues(s);
    const [existing] = await this.db.query("SELECT revision FROM drafts WHERE number = ?", [s.number]);
    if (!existing) {
      await this.db.run(`INSERT INTO drafts (${COLUMNS.join(",")}) VALUES (${COLUMNS.map(() => "?").join(",")})`, values);
      return;
    }
    const byName = new Map(COLUMNS.map((c, i) => [c, values[i] ?? null]));
    const { changes } = await this.db.run(
      `UPDATE drafts SET ${UPDATABLE.map((c) => `${c} = ?`).join(", ")}, revision = revision + 1 WHERE number = ? AND revision = ?`,
      [...UPDATABLE.map((c) => byName.get(c) ?? null), s.number, s.revision],
    );
    if (changes === 0) throw new StaleDraft(s.number);
  }
}
