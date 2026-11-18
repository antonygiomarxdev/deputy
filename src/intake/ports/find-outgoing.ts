import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { SendId } from "../../shared/send-id";

export type FindOutgoingResult =
  | { kind: "found"; providerMessageIds: string[] }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: number }
  | { kind: "partial"; found: number; expected: number }
  | { kind: "refused"; reason: "not_owner" };

export interface FindOutgoing {
  execute(q: { sendId: SendId; chat: ChatId; since: Instant; text: string }): Promise<FindOutgoingResult>;
}
