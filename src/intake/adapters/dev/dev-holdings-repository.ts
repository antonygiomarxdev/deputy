import type { Instant } from "../../../shared/instant";
import type { SqlDatabase, SqlRow } from "../../../shared/sql-database";

export interface HoldingInput {
  id: string | null;
  kind: "in" | "out";
  chat: string;
  sender: string | null;
  direction: "inbound" | "outbound";
  type: string;
  text: string;
  transcript: string | null;
  origin: string;
  sentAt: Instant;
  ownerMark: boolean;
}

/** The dev_holdings table: what the dev provider holds in place of WhatsApp. */
export class DevHoldingsRepository {
  constructor(private readonly db: SqlDatabase) {}

  /** Returns whether the row is new. A held copy with no id of its own gets `dev-in-<seq>` or `dev-out-<seq>`. */
  async insert(h: HoldingInput): Promise<{ providerMessageId: string; isNew: boolean }> {
    return this.db.transaction(async (tx) => {
      const placeholder = h.id ?? `dev-pending-${crypto.randomUUID()}`;
      const r = await tx.run(
        `INSERT INTO dev_holdings
           (provider_message_id, conversation_ref, counterpart, sender, direction, type, text, transcript, origin, sent_at, owner_mark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider_message_id) DO NOTHING`,
        [placeholder, h.chat, h.chat, h.sender, h.direction, h.type, h.text, h.transcript, h.origin, h.sentAt, h.ownerMark ? 1 : 0],
      );
      if (r.changes === 0) return { providerMessageId: placeholder, isNew: false };
      if (h.id !== null) return { providerMessageId: h.id, isNew: true };
      const id = `dev-${h.kind}-${r.lastInsertId}`;
      await tx.run("UPDATE dev_holdings SET provider_message_id = ? WHERE seq = ?", [id, r.lastInsertId]);
      return { providerMessageId: id, isNew: true };
    });
  }

  /** Conversations with a message at or after `activeAfter`, newest first. Returns one row past `limit` so the caller knows about a next page. */
  conversations(activeAfter: Instant | null, offset: number, limit: number): Promise<SqlRow[]> {
    return this.db.query(
      `SELECT conversation_ref, MAX(sent_at) AS last FROM dev_holdings
       WHERE conversation_ref IS NOT NULL
       GROUP BY conversation_ref HAVING (? IS NULL OR MAX(sent_at) >= ?)
       ORDER BY last DESC, conversation_ref LIMIT ? OFFSET ?`,
      [activeAfter, activeAfter, limit + 1, offset],
    );
  }

  /** Messages of one conversation, or of all outbound ones, newest first. Returns one row past `limit`. */
  messages(scope: { conversationRef: string } | { outbound: true }, offset: number, limit: number): Promise<SqlRow[]> {
    const [where, params] =
      "conversationRef" in scope
        ? ["conversation_ref = ?", [scope.conversationRef]]
        : ["direction = 'outbound'", []];
    return this.db.query(
      `SELECT * FROM dev_holdings WHERE ${where} ORDER BY sent_at DESC, seq DESC LIMIT ? OFFSET ?`,
      [...params, limit + 1, offset],
    );
  }
}
