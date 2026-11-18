import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { SendId } from "../../shared/send-id";

export type SendTextResult =
  | { kind: "sent"; providerMessageIds: string[] }
  | { kind: "failed"; reason: "credentials" | "unreachable" | "quota" | "rejected" | "unsupported_chat" }
  /** Nothing was delivered (owner decision D29). */
  | { kind: "rate_limited"; retryAt: Instant }
  | { kind: "unknown"; partsSent: number; partsTotal: number }
  | { kind: "refused"; reason: "not_owner" };

export interface SendText {
  execute(q: { sendId: SendId; chat: ChatId; text: string }): Promise<SendTextResult>;
}
