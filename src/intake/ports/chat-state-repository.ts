import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { ChatState } from "../domain/chat-state";

export interface ChatSeen {
  providerId: string | null;
  conversationRef: string | null;
}

export interface ChatStateRepository {
  /** Recomputes the row from messages. providerId is kept once set (the first seen); conversationRef takes the newest non-null. */
  recompute(chat: ChatId, dev: boolean, now: Instant, seen: ChatSeen): Promise<void>;
  setProfileName(chat: ChatId, dev: boolean, name: string): Promise<void>;
  list(q: { dev: boolean; customerMessageSince?: Instant }): Promise<ChatState[]>;
  get(chat: ChatId, dev: boolean): Promise<ChatState | null>;
}
