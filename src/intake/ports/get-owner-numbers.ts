import type { Instant } from "../../shared/instant";

export interface OwnerNumbersView {
  numbers: ReadonlyArray<{ number: string; kind: "business" | "extra"; label: string; addedAt: Instant }>;
  /** Oldest first, with the command the owner typed; present only when asked for. */
  log?: ReadonlyArray<{ at: Instant; action: "add" | "remove"; number: string; kind: string; command: string }>;
}

/** A pure read: no lease. */
export interface GetOwnerNumbers {
  execute(q: { withLog?: boolean }): Promise<OwnerNumbersView>;
}
