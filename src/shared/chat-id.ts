import type { PhoneNumber } from "./phone-number";

export type ChatId = string & { readonly __chatId: true };

export const UNATTRIBUTED_CHAT = "unattributed" as ChatId;

export function parseChatId(raw: string): ChatId | null {
  return raw.trim() === "" ? null : (raw as ChatId);
}

export function lineChatId(n: PhoneNumber): ChatId {
  return n.lineKey() as ChatId;
}

export function groupChatId(providerGroupId: string): ChatId {
  return `group:${providerGroupId}` as ChatId;
}
