import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { MessageId } from "../../shared/message-id";

export type ChatMessage = {
  readonly id: MessageId;
  readonly sentAt: Instant;
  readonly storedAt: Instant;
  readonly source: "customer" | "owner_app" | "sent_through_deputy";
  readonly text: string; // Intake's readerText
  readonly dev: boolean;
  readonly history: boolean;
};

export type ChatInfo = {
  readonly hasCustomerMessage: boolean;
  readonly hasNonDevMessage: boolean;
  readonly activeWorldIsDev: boolean;
  readonly latestCustomer: ChatMessage | null;
  readonly latest: ChatMessage | null;
};

export interface ChatReader {
  describe(chat: ChatId): Promise<ChatInfo | null>; // null when the chat is unknown
  message(chat: ChatId, id: MessageId): Promise<ChatMessage | null>;
}

/** Intake's IsCustomerText: does the text equal a stored customer message, in any chat? */
export interface CustomerTextCheck {
  isCustomerText(words: string): Promise<boolean>;
}
