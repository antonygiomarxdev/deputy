import type { ChatId } from "../../../shared/chat-id";
import { messageIdKey, type MessageId } from "../../../shared/message-id";
import type { ChatInfo, ChatMessage, ChatReader } from "../../ports/outbound";

/** Built from a list of messages per chat. `calls` records the order of the calls made on it. */
export class FakeChatReader implements ChatReader {
  readonly calls: string[] = [];
  onDescribe: () => void = () => {};

  constructor(
    private readonly chats: Readonly<Record<string, readonly ChatMessage[]>>,
    private readonly options: { activeWorldIsDev?: boolean } = {},
  ) {}

  async describe(chat: ChatId): Promise<ChatInfo | null> {
    this.calls.push("describe");
    this.onDescribe();
    const messages = this.chats[chat];
    if (!messages) return null;
    const bySentAt = [...messages].sort((a, b) => a.sentAt - b.sentAt);
    const customers = bySentAt.filter((m) => m.source === "customer");
    return {
      hasCustomerMessage: customers.length > 0,
      hasNonDevMessage: messages.some((m) => !m.dev),
      activeWorldIsDev: this.options.activeWorldIsDev ?? false,
      latestCustomer: customers.at(-1) ?? null,
      latest: bySentAt.at(-1) ?? null,
    };
  }

  async message(chat: ChatId, id: MessageId): Promise<ChatMessage | null> {
    this.calls.push("message");
    return this.chats[chat]?.find((m) => messageIdKey(m.id) === messageIdKey(id)) ?? null;
  }
}
