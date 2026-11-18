import { flag, num, numOrNull, str, strOrNull } from "../../../adapters/sqlite/row";
import { parseChatId, type ChatId } from "../../../shared/chat-id";
import type { Instant } from "../../../shared/instant";
import type { MessageId } from "../../../shared/message-id";
import { PhoneNumber } from "../../../shared/phone-number";
import type { ProviderName } from "../../../shared/provider-name";
import type { SqlExecutor, SqlRow } from "../../../shared/sql-database";
import type { Source } from "../../../shared/source";
import { normalizeText } from "../../../shared/text";
import { Message, type Mark, type MessageVersion } from "../../domain/message";
import type { MessageRepository } from "../../ports/message-repository";

function providerOf(r: SqlRow): ProviderName {
  const p = str(r, "provider");
  if (p !== "kapso" && p !== "dev") throw new Error(`provider '${p}'`);
  return p;
}

function sourceOf(r: SqlRow): Source {
  const s = str(r, "source");
  if (s !== "customer" && s !== "owner_app" && s !== "sent_through_deputy") throw new Error(`source '${s}'`);
  return s;
}

function markOf(r: SqlRow): Mark {
  const m = str(r, "mark");
  if (m !== "normal" && m !== "group_chat" && m !== "sender_unknown" && m !== "not_attributable") {
    throw new Error(`mark '${m}'`);
  }
  return m;
}

function toMessage(r: SqlRow, versions: readonly MessageVersion[]): Message {
  const chat = parseChatId(str(r, "chat_id"));
  if (chat === null) throw new Error("stored chat id is empty");
  const sender = strOrNull(r, "sender");
  return Message.rehydrate(
    {
      id: { provider: providerOf(r), providerMessageId: str(r, "provider_message_id") },
      chat,
      conversationRef: strOrNull(r, "conversation_ref"),
      sender: sender === null ? null : PhoneNumber.fromInternational(sender),
      providerSender: strOrNull(r, "provider_sender"),
      type: str(r, "type"),
      readable: flag(r, "readable"),
      text: strOrNull(r, "text"),
      transcript: strOrNull(r, "transcript"),
      sentAt: num(r, "sent_at"),
      storedAt: num(r, "stored_at"),
      origin: strOrNull(r, "origin"),
      source: sourceOf(r),
      mark: markOf(r),
      history: flag(r, "history"),
      dev: flag(r, "dev"),
      edited: flag(r, "edited"),
      deletedBySender: flag(r, "deleted_by_sender"),
    },
    versions,
  );
}

export class SqliteMessageRepository implements MessageRepository {
  constructor(private readonly ex: SqlExecutor) {}

  async insertIfNew(m: Message): Promise<"stored" | "duplicate"> {
    const p = m.props;
    const r = await this.ex.run(
      `INSERT INTO messages
       (provider, provider_message_id, chat_id, conversation_ref, sender, provider_sender, type, readable, text, text_norm,
        transcript, sent_at, stored_at, origin, source, mark, history, dev, edited, deleted_by_sender)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (provider, provider_message_id) DO NOTHING`,
      [
        p.id.provider, p.id.providerMessageId, p.chat, p.conversationRef, p.sender?.e164 ?? null, p.providerSender,
        p.type, p.readable ? 1 : 0, p.text, m.textNorm, p.transcript, p.sentAt, p.storedAt, p.origin, p.source,
        p.mark, p.history ? 1 : 0, p.dev ? 1 : 0, p.edited ? 1 : 0, p.deletedBySender ? 1 : 0,
      ],
    );
    return r.changes === 1 ? "stored" : "duplicate";
  }

  async find(id: MessageId): Promise<Message | null> {
    const rows = await this.ex.query("SELECT * FROM messages WHERE provider = ? AND provider_message_id = ?", [
      id.provider,
      id.providerMessageId,
    ]);
    const row = rows[0];
    return row === undefined ? null : toMessage(row, await this.versionsOf(row));
  }

  // shortcut: one query per id; callers pass a handful of ids, batch it if a use case ever passes hundreds.
  async findMany(ids: readonly MessageId[]): Promise<Message[]> {
    const found: Message[] = [];
    for (const id of ids) {
      const m = await this.find(id);
      if (m !== null) found.push(m);
    }
    return found;
  }

  async saveEdit(id: MessageId, version: MessageVersion, text: string): Promise<void> {
    await this.ex.run(
      "INSERT INTO message_versions (provider, provider_message_id, version, text, replaced_at) VALUES (?, ?, ?, ?, ?)",
      [id.provider, id.providerMessageId, version.version, version.text, version.replacedAt],
    );
    await this.ex.run(
      `UPDATE messages SET text = ?, text_norm = CASE WHEN readable = 1 THEN ? ELSE NULL END, edited = 1
       WHERE provider = ? AND provider_message_id = ?`,
      [text, normalizeText(text), id.provider, id.providerMessageId],
    );
  }

  async markDeleted(id: MessageId): Promise<void> {
    await this.ex.run("UPDATE messages SET deleted_by_sender = 1 WHERE provider = ? AND provider_message_id = ?", [
      id.provider,
      id.providerMessageId,
    ]);
  }

  async listChat(chat: ChatId, q: { limit?: number; storedSince?: Instant }): Promise<Message[]> {
    const rows =
      q.limit === undefined
        ? await this.ex.query("SELECT * FROM messages WHERE chat_id = ? ORDER BY sent_at, seq", [chat])
        : await this.ex.query(
            `SELECT * FROM messages WHERE chat_id = ?
             AND (seq IN (SELECT seq FROM messages WHERE chat_id = ? ORDER BY sent_at DESC, seq DESC LIMIT ?)
                  OR stored_at >= ?)
             ORDER BY sent_at, seq`,
            [chat, chat, q.limit, q.storedSince ?? Number.MAX_SAFE_INTEGER],
          );
    const out: Message[] = [];
    for (const r of rows) out.push(toMessage(r, await this.versionsOf(r)));
    return out;
  }

  async chatExists(chat: ChatId): Promise<{ exists: boolean; hasNonDevMessage: boolean }> {
    const [r] = await this.ex.query(
      "SELECT COUNT(*) AS n, COALESCE(SUM(dev = 0), 0) AS real FROM messages WHERE chat_id = ?",
      [chat],
    );
    return { exists: r !== undefined && num(r, "n") > 0, hasNonDevMessage: r !== undefined && num(r, "real") > 0 };
  }

  async hasCustomerTextNorm(norm: string): Promise<boolean> {
    const rows = await this.ex.query(
      "SELECT 1 AS hit FROM messages WHERE source = 'customer' AND text_norm = ? LIMIT 1",
      [norm],
    );
    return rows.length > 0;
  }

  async newestUnattributedStoredAt(dev: boolean): Promise<Instant | null> {
    const [r] = await this.ex.query(
      "SELECT MAX(stored_at) AS at FROM messages WHERE mark = 'not_attributable' AND dev = ?",
      [dev ? 1 : 0],
    );
    return r === undefined ? null : numOrNull(r, "at");
  }

  async newestStoredBefore(
    provider: ProviderName,
    scope: { conversationRef: string } | { ownerOrDeputy: true },
    before: Instant,
  ): Promise<Instant | null> {
    const [where, params] =
      "conversationRef" in scope
        ? ["conversation_ref = ?", [scope.conversationRef]]
        : ["source IN ('owner_app', 'sent_through_deputy')", []];
    const [r] = await this.ex.query(
      `SELECT MAX(sent_at) AS at FROM messages WHERE provider = ? AND sent_at < ? AND ${where}`,
      [provider, before, ...params],
    );
    return r === undefined ? null : numOrNull(r, "at");
  }

  async newestStoredAt(provider: ProviderName): Promise<Instant | null> {
    const [r] = await this.ex.query("SELECT MAX(sent_at) AS at FROM messages WHERE provider = ?", [provider]);
    return r === undefined ? null : numOrNull(r, "at");
  }

  async oldestStoredAt(provider: ProviderName): Promise<Instant | null> {
    const [r] = await this.ex.query("SELECT MIN(sent_at) AS at FROM messages WHERE provider = ?", [provider]);
    return r === undefined ? null : numOrNull(r, "at");
  }

  private async versionsOf(r: SqlRow): Promise<MessageVersion[]> {
    if (!flag(r, "edited")) return [];
    const rows = await this.ex.query(
      "SELECT version, text, replaced_at FROM message_versions WHERE provider = ? AND provider_message_id = ? ORDER BY version",
      [str(r, "provider"), str(r, "provider_message_id")],
    );
    return rows.map((v) => ({ version: num(v, "version"), text: strOrNull(v, "text"), replacedAt: num(v, "replaced_at") }));
  }
}
