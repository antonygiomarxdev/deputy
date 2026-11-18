import type { ProviderName } from "./provider-name";

export interface MessageId {
  readonly provider: ProviderName;
  readonly providerMessageId: string;
}

export function messageIdKey(id: MessageId): string {
  return `${id.provider}:${id.providerMessageId}`;
}
