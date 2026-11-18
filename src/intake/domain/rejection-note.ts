import type { Instant } from "../../shared/instant";

export type RejectionReason =
  | "bad_signature"
  | "missing_signature"
  | "no_secret"
  | "no_identifier"
  | "malformed"
  | "dev_entry_refused";

/** No content field exists on purpose: a note never keeps what was rejected. */
export interface RejectionNote {
  readonly at: Instant;
  readonly reason: RejectionReason;
  readonly recoverable: boolean;
  readonly resolvedAt: Instant | null;
}
