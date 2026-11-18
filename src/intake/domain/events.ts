import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";
import type { OwnerReplyUnlinked } from "../../shared/signals";
import type { SyncReason } from "./sync-state";

/** One item per chat and source; only newly stored, non-history, non-Deputy messages; no text or name (FR-INTAKE-02-9). */
export interface MessageStored {
  readonly name: "MessageStored";
  readonly origin: "live" | "catch_up";
  readonly items: ReadonlyArray<{ chat: ChatId; source: "customer" | "owner_app"; count: number }>;
  readonly at: Instant;
}

export interface CatchUpFinished {
  readonly name: "CatchUpFinished";
  readonly provider: ProviderName;
  readonly status: "complete" | "failed";
  readonly reason: SyncReason | null;
  readonly storedCount: number; // all stored, history included
  readonly finishedAt: Instant;
}

export type IntakeEvent = MessageStored | OwnerReplyUnlinked | CatchUpFinished;
