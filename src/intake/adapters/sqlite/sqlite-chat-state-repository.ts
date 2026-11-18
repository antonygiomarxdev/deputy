import { numOrNull, str, strOrNull, flag } from "../../../adapters/sqlite/row";
import { UNATTRIBUTED_CHAT, parseChatId, type ChatId } from "../../../shared/chat-id";
import type { Instant } from "../../../shared/instant";
import type { SqlExecutor, SqlRow } from "../../../shared/sql-database";
import type { ChatState } from "../../domain/chat-state";
import type { Mark } from "../../domain/message";
import type { ChatSeen, ChatStateRepository } from "../../ports/chat-state-repository";

export function chatMark(chat: ChatId): Mark {
  if (chat.startsWith("group:")) return "group_chat";
  return chat === UNATTRIBUTED_CHAT ? "not_attributable" : "normal";
}

function toState(r: SqlRow): ChatState {
  const chat = parseChatId(str(r, "chat_id"));
  if (chat === null) throw new Error("stored chat id is empty");
  const answer = strOrNull(r, "last_answer_source");
  if (answer !== null && answer !== "owner_app" && answer !== "sent_through_deputy") {
    throw new Error(`last_answer_source '${answer}'`);
  }
  return {
    chat,
    dev: flag(r, "dev"),
    mark: chatMark(chat),
    conversationRef: strOrNull(r, "conversation_ref"),
    providerId: strOrNull(r, "provider_id"),
    lastCustomerAt: numOrNull(r, "last_customer_at"),
    lastCustomerMessageId: strOrNull(r, "last_customer_message_id"),
    lastAnswerAt: numOrNull(r, "last_answer_at"),
    lastAnswerSource: answer,
    lastUnattributedAt: numOrNull(r, "last_unattributed_at"),
    profileName: strOrNull(r, "profile_name"),
    updatedAt: numOrNull(r, "updated_at") ?? 0,
  };
}

export class SqliteChatStateRepository implements ChatStateRepository {
  constructor(private readonly ex: SqlExecutor) {}

  async recompute(chat: ChatId, dev: boolean, now: Instant, seen: ChatSeen): Promise<void> {
    const d = dev ? 1 : 0;
    // last_customer_at counts only mark = 'normal'; the answer is the newest owner or Deputy message; history counts in both.
    await this.ex.run(
      `INSERT INTO chats (chat_id, dev, mark, conversation_ref, provider_id, last_customer_at, last_customer_message_id,
                          last_answer_at, last_answer_source, last_unattributed_at, updated_at)
       VALUES (?, ?, ?, ?, ?,
         (SELECT sent_at FROM messages WHERE chat_id = ? AND dev = ? AND source = 'customer' AND mark = 'normal' ORDER BY sent_at DESC, seq DESC LIMIT 1),
         (SELECT provider_message_id FROM messages WHERE chat_id = ? AND dev = ? AND source = 'customer' AND mark = 'normal' ORDER BY sent_at DESC, seq DESC LIMIT 1),
         (SELECT sent_at FROM messages WHERE chat_id = ? AND dev = ? AND source IN ('owner_app','sent_through_deputy') ORDER BY sent_at DESC, seq DESC LIMIT 1),
         (SELECT source FROM messages WHERE chat_id = ? AND dev = ? AND source IN ('owner_app','sent_through_deputy') ORDER BY sent_at DESC, seq DESC LIMIT 1),
         (SELECT MAX(sent_at) FROM messages WHERE chat_id = ? AND dev = ? AND mark = 'not_attributable'),
         ?)
       ON CONFLICT (chat_id, dev) DO UPDATE SET
         mark = excluded.mark,
         conversation_ref = COALESCE(excluded.conversation_ref, chats.conversation_ref),
         provider_id = COALESCE(chats.provider_id, excluded.provider_id),
         last_customer_at = excluded.last_customer_at,
         last_customer_message_id = excluded.last_customer_message_id,
         last_answer_at = excluded.last_answer_at,
         last_answer_source = excluded.last_answer_source,
         last_unattributed_at = excluded.last_unattributed_at,
         updated_at = excluded.updated_at`,
      [
        chat, d, chatMark(chat), seen.conversationRef, seen.providerId,
        chat, d, chat, d, chat, d, chat, d, chat, d,
        now,
      ],
    );
  }

  async setProfileName(chat: ChatId, dev: boolean, name: string): Promise<void> {
    await this.ex.run("UPDATE chats SET profile_name = ? WHERE chat_id = ? AND dev = ?", [name, chat, dev ? 1 : 0]);
  }

  async list(q: { dev: boolean; customerMessageSince?: Instant }): Promise<ChatState[]> {
    const rows =
      q.customerMessageSince === undefined
        ? await this.ex.query("SELECT * FROM chats WHERE dev = ? ORDER BY chat_id", [q.dev ? 1 : 0])
        : await this.ex.query("SELECT * FROM chats WHERE dev = ? AND last_customer_at >= ? ORDER BY chat_id", [
            q.dev ? 1 : 0,
            q.customerMessageSince,
          ]);
    return rows.map(toState);
  }

  async get(chat: ChatId, dev: boolean): Promise<ChatState | null> {
    const [r] = await this.ex.query("SELECT * FROM chats WHERE chat_id = ? AND dev = ?", [chat, dev ? 1 : 0]);
    return r === undefined ? null : toState(r);
  }
}

export function createSqliteChatStateRepository(ex: SqlExecutor): SqliteChatStateRepository {
  return new SqliteChatStateRepository(ex);
}
