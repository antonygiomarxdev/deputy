import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { Mark } from "./message";

/** The chat mark is group_chat for a "group:" chat, not_attributable for UNATTRIBUTED_CHAT, else normal. */
export interface ChatState {
  readonly chat: ChatId;
  readonly dev: boolean;
  readonly mark: Mark;
  readonly conversationRef: string | null;
  readonly providerId: string | null;
  readonly lastCustomerAt: Instant | null;
  readonly lastCustomerMessageId: string | null;
  readonly lastAnswerAt: Instant | null;
  readonly lastAnswerSource: "owner_app" | "sent_through_deputy" | null;
  readonly lastUnattributedAt: Instant | null;
  readonly profileName: string | null;
  readonly updatedAt: Instant;
}
