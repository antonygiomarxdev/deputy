import type { Instant } from "./instant";

/** Intake publishes it (D30). */
export interface OwnerReplyUnlinked {
  readonly name: "OwnerReplyUnlinked";
  readonly at: Instant;
}

export type SendNeedsOwnerReason = "held_after_retry" | "window_closed" | "retry_failed";

/** Drafts publishes it (D29); Notify turns it into a notice. */
export interface SendNeedsOwner {
  readonly reason: SendNeedsOwnerReason;
  readonly at: Instant;
}
