import type { ChatId } from "../../shared/chat-id";

export interface ChatExists {
  execute(q: { chat: ChatId }): Promise<{ exists: boolean; hasNonDevMessage: boolean; activeWorldIsDev: boolean }>;
}
