import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { MessageId } from "../../shared/message-id";
import type { Source } from "../../shared/source";
import type { Mark } from "../domain/message";

export interface ChatStateView {
  chat: ChatId;
  mark: Mark;
  conversationRef: string | null;
  lastCustomerAt: Instant | null;
  lastCustomerMessageId: MessageId | null;
  lastAnswerAt: Instant | null;
  lastAnswerSource: "owner_app" | "sent_through_deputy" | null;
  lastUnattributedAt: Instant | null;
  unattributedStoredAt: Instant | null;
  /** Untrusted customer text: a display hint; consumers escape and label it and never match on it. */
  profileName?: string;
}

export interface MessageView {
  id: MessageId;
  chat: ChatId;
  sender: string | null;
  type: string;
  readable: boolean;
  text: string | null;
  transcript: string | null;
  readerText: string;
  sentAt: Instant;
  storedAt: Instant;
  source: Source;
  history: boolean;
  dev: boolean;
  edited: boolean;
  previousTexts: readonly string[];
  deletedBySender: boolean;
  mark: Mark;
}

/** Sent order. */
export interface ChatView {
  chat: ChatId;
  mark: Mark;
  messages: ReadonlyArray<MessageView>;
}
