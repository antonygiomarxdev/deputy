import type { Instant } from "../../shared/instant";

export interface PendingChange {
  readonly id: number;
  readonly key: "owner_numbers" | "business_number" | "owner_number_remove";
  readonly value: string;
  /** The command the owner typed. */
  readonly command: string;
  readonly at: Instant;
}

export interface PendingChangesReader {
  /** Unapplied rows of those three keys, oldest first. */
  takeOwnerNumberChanges(): Promise<PendingChange[]>;
  markApplied(id: number, at: Instant): Promise<void>;
}
