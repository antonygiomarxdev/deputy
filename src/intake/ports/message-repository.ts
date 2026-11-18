import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { MessageId } from "../../shared/message-id";
import type { ProviderName } from "../../shared/provider-name";
import type { Message, MessageVersion } from "../domain/message";

export interface MessageRepositoryGap {
  /** Newest sent_at stored under `provider` in `scope` that is older than `before`, or null. `ownerOrDeputy` is source owner_app or sent_through_deputy. */
  newestStoredBefore(
    provider: ProviderName,
    scope: { conversationRef: string } | { ownerOrDeputy: true },
    before: Instant,
  ): Promise<Instant | null>;
  /** MAX(sent_at) under `provider`. */
  newestStoredAt(provider: ProviderName): Promise<Instant | null>;
  /** MIN(sent_at) under `provider`. */
  oldestStoredAt(provider: ProviderName): Promise<Instant | null>;
}

export interface MessageRepository extends MessageRepositoryGap {
  insertIfNew(m: Message): Promise<"stored" | "duplicate">;
  find(id: MessageId): Promise<Message | null>;
  /** Unknown ids are absent from the result. */
  findMany(ids: readonly MessageId[]): Promise<Message[]>;
  saveEdit(id: MessageId, version: MessageVersion, text: string): Promise<void>;
  markDeleted(id: MessageId): Promise<void>;
  /**
   * Sent order: (sent_at, seq), oldest first. Both worlds; each message carries dev.
   * With `limit`: the newest `limit` by sent order, plus every message with stored_at >= `storedSince`.
   * Without `limit`: every message.
   */
  listChat(chat: ChatId, q: { limit?: number; storedSince?: Instant }): Promise<Message[]>;
  chatExists(chat: ChatId): Promise<{ exists: boolean; hasNonDevMessage: boolean }>;
  /** True when a customer-source message of any chat or world has this text_norm. */
  hasCustomerTextNorm(norm: string): Promise<boolean>;
  /** Local time the newest message with mark not_attributable of this world was stored. */
  newestUnattributedStoredAt(dev: boolean): Promise<Instant | null>;
}
