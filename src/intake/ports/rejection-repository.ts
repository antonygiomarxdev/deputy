import type { Instant } from "../../shared/instant";
import type { RejectionNote, RejectionReason } from "../domain/rejection-note";

export const REJECTION_MAX_ROWS = 500; // ADR-005: bounds storage under a flood
export const REJECTION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // ADR-005: 30 days

export interface RejectionRepository {
  /** Inserts, then prunes in the same call: keeps the newest 500 rows and nothing older than 30 days, and adds the deleted count to rejection_pruned. */
  add(at: Instant, reason: RejectionReason, recoverable: boolean): Promise<void>;
  /** Newest first. */
  list(): Promise<{ notes: RejectionNote[]; prunedCount: number; unrecovered: number }>;
  resolveRecoverableBefore(runStartedAt: Instant, at: Instant): Promise<void>;
}
