import { OwnerNumbers, type OwnerNumberEntry, type OwnerNumberLogEntry } from "../../domain/owner-numbers";
import type { OwnerNumbersRepository } from "../../ports/owner-numbers-repository";

export class InMemoryOwnerNumbersRepository implements OwnerNumbersRepository {
  private saved: readonly OwnerNumberEntry[] = [];
  private entries: OwnerNumberLogEntry[] = [];

  async load(): Promise<OwnerNumbers> {
    return OwnerNumbers.of(this.saved);
  }

  async save(o: OwnerNumbers, log: readonly OwnerNumberLogEntry[]): Promise<void> {
    this.saved = [...o.entries()];
    this.entries.push(...log);
  }

  async log(): Promise<OwnerNumberLogEntry[]> {
    return [...this.entries];
  }
}
