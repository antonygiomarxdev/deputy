import { messageIdKey } from "../../shared/message-id";
import { toIso } from "../domain/time";
import type { MessageView } from "../ports/inbound";
import type { ChatMessage } from "../ports/chat";

export function messageView(m: ChatMessage): MessageView {
  return { id: messageIdKey(m.id), sentAt: toIso(m.sentAt), text: m.text, source: m.source };
}
