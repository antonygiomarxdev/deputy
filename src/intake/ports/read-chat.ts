import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { ChatView } from "./views";

/** Null when the chat has no message. Never filters by the history flag. */
export interface ReadChat {
  execute(q: { chat: ChatId; limit?: number; storedSince?: Instant }): Promise<ChatView | null>;
}
