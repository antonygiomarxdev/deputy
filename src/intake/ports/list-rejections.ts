import type { Instant } from "../../shared/instant";
import type { RejectionReason } from "../domain/rejection-note";

/** Time and reason only: a note never keeps what was rejected. */
export interface ListRejections {
  execute(): Promise<{
    notes: ReadonlyArray<{ at: Instant; reason: RejectionReason; recoverable: boolean; resolved: boolean }>;
    prunedCount: number;
    unrecovered: number;
  }>;
}
