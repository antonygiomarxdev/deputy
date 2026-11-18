import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";

/** Used only by application/approve-draft.ts; Intake's SendText sits behind it. */
export interface Sender {
  send(
    chat: ChatId,
    text: string,
    sendId: string,
  ): Promise<
    | { kind: "sent" }
    | { kind: "failed"; reason: "credentials" | "unreachable" | "quota" | "rejected" | "unsupported_chat" }
    | { kind: "rate_limited"; retryAt: Instant }
    | { kind: "unknown"; partsSent: number; partsTotal: number }
    | { kind: "refused"; reason: "not_owner" }
  >;
}
