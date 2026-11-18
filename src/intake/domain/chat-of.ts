import { groupChatId, lineChatId, UNATTRIBUTED_CHAT, type ChatId } from "../../shared/chat-id";
import { PhoneNumber } from "../../shared/phone-number";
import type { ProviderMessage } from "../ports/provider";
import type { Mark } from "./message";

export function chatOf(p: ProviderMessage): ChatId {
  if (p.group) return groupChatId(p.counterpart ?? p.conversationRef ?? "unknown");
  const other = p.counterpart ?? (p.direction === "inbound" ? p.from : null);
  const number = other === null ? null : PhoneNumber.fromInternational(other);
  return number === null ? UNATTRIBUTED_CHAT : lineChatId(number);
}

/** `matchesSend`: a Deputy send the provider echoes without a sender is attributable (L8). */
export function markOf(p: ProviderMessage, sender: PhoneNumber | null, chat: ChatId, matchesSend = false): Mark {
  if (p.group) return "group_chat";
  if (chat === UNATTRIBUTED_CHAT) return "not_attributable";
  if (sender === null && p.direction === "outbound") return matchesSend ? "normal" : "not_attributable";
  if (sender === null) return "sender_unknown";
  return "normal";
}
