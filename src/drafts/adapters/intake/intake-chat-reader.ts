import type { ChatId } from "../../../shared/chat-id";
import { messageIdKey, type MessageId } from "../../../shared/message-id";
import type { ChatExists, ReadChat } from "../../../intake/index";
import type { ChatInfo, ChatMessage, ChatReader } from "../../ports/outbound";

type IntakeMessage = NonNullable<Awaited<ReturnType<ReadChat["execute"]>>>["messages"][number];

const toChatMessage = (m: IntakeMessage): ChatMessage => ({
  id: m.id, sentAt: m.sentAt, storedAt: m.storedAt, source: m.source, text: m.readerText, dev: m.dev, history: m.history,
});

export class IntakeChatReader implements ChatReader {
  constructor(private readonly intake: { chatExists: ChatExists; readChat: ReadChat }) {}

  async describe(chat: ChatId): Promise<ChatInfo | null> {
    const exists = await this.intake.chatExists.execute({ chat });
    if (!exists.exists) return null;
    const view = await this.intake.readChat.execute({ chat });
    if (view === null) return null;
    const messages = view.messages.map(toChatMessage);
    return {
      hasCustomerMessage: messages.some((m) => m.source === "customer"),
      hasNonDevMessage: exists.hasNonDevMessage,
      activeWorldIsDev: exists.activeWorldIsDev,
      latestCustomer: newest(messages.filter((m) => m.source === "customer")),
      latest: newest(messages),
    };
  }

  async message(chat: ChatId, id: MessageId): Promise<ChatMessage | null> {
    const view = await this.intake.readChat.execute({ chat });
    const found = view?.messages.find((m) => messageIdKey(m.id) === messageIdKey(id));
    return found ? toChatMessage(found) : null;
  }
}

/** The latest by send time; the last of equal times wins, as Intake lists in sent order. */
function newest(messages: readonly ChatMessage[]): ChatMessage | null {
  return messages.reduce<ChatMessage | null>((best, m) => (best === null || m.sentAt >= best.sentAt ? m : best), null);
}
