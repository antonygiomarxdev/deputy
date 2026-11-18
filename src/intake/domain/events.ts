import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { OwnerReplyUnlinked } from "../../shared/signals";

/** One item per chat and source; only newly stored, non-history, non-Deputy messages; no text or name (FR-INTAKE-02-9). */
export interface MessageStored {
  readonly name: "MessageStored";
  readonly origin: "live" | "catch_up";
  readonly items: ReadonlyArray<{ chat: ChatId; source: "customer" | "owner_app"; count: number }>;
  readonly at: Instant;
}

export type IntakeEvent = MessageStored | OwnerReplyUnlinked;
