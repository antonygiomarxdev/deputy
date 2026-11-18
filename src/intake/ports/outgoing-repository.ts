import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { MessageId } from "../../shared/message-id";
import type { ProviderName } from "../../shared/provider-name";
import type { SendId } from "../../shared/send-id";
import type { OutgoingSend } from "../domain/outgoing-send";

export interface OutgoingRepository {
  find(sendId: SendId): Promise<OutgoingSend | null>;
  /** The send and its parts. */
  insert(s: OutgoingSend): Promise<void>;
  /** One part row; `provider` is the provider the part's id belongs to (the send itself does not know it). */
  savePart(s: OutgoingSend, part: number, provider: ProviderName): Promise<void>;
  /** State, failure_reason and finished_at. */
  saveSend(s: OutgoingSend): Promise<void>;
  findByProviderId(provider: ProviderName, providerMessageId: string): Promise<{ sendId: SendId; part: number } | null>;
  /** Every outgoing row and part left pending becomes unknown. Returns the number of sends changed. */
  markPendingAsUnknown(): Promise<number>;
  /** Messages of `chat` with source owner_app and exactly this text, sent at or after `since`, whose id is in no outgoing_parts row. */
  candidatesForPart(chat: ChatId, text: string, since: Instant): Promise<MessageId[]>;
}
