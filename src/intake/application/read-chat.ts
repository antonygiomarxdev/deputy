import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import { chatMarkOf } from "../domain/chat-state";
import type { IntakeRepos } from "../ports/intake-unit-of-work";
import type { ReadChat } from "../ports/read-chat";
import type { ChatView } from "../ports/views";
import { toMessageView } from "./message-view";

export class ReadChatUseCase implements ReadChat {
  constructor(private readonly repos: Pick<IntakeRepos, "messages">) {}

  async execute(q: { chat: ChatId; limit?: number; storedSince?: Instant }): Promise<ChatView | null> {
    const messages = await this.repos.messages.listChat(q.chat, {
      ...(q.limit === undefined ? {} : { limit: q.limit }),
      ...(q.storedSince === undefined ? {} : { storedSince: q.storedSince }),
    });
    if (messages.length === 0) return null;
    return { chat: q.chat, mark: chatMarkOf(q.chat), messages: messages.map(toMessageView) };
  }
}
