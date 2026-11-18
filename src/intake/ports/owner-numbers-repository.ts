import type { OwnerNumberLogEntry, OwnerNumbers } from "../domain/owner-numbers";

export interface OwnerNumbersRepository {
  load(): Promise<OwnerNumbers>;
  /** One transaction: the set and its log entries are stored together or not at all. */
  save(o: OwnerNumbers, log: readonly OwnerNumberLogEntry[]): Promise<void>;
  /** Oldest first. */
  log(): Promise<OwnerNumberLogEntry[]>;
}
