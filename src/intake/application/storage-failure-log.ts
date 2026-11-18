import type { Instant } from "../../shared/instant";

/** Time of the last storage failure, kept in memory only (it feeds the status report). */
export class StorageFailureLog {
  private at: Instant | null = null;

  record(at: Instant): void {
    this.at = at;
  }

  last(): Instant | null {
    return this.at;
  }
}
