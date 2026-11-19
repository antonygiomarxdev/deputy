import type { Clock } from "../../shared/clock";
import type { Instant } from "../../shared/instant";
import type { StoredReason } from "../domain/sync-state";
import type { ListingRead } from "./gap-probe";
import type { StoredSummary } from "./store-messages";

/** What a run stored so far, folded for the one MessageStored it publishes. */
export class RunTotals {
  stored = 0;
  /** A page was stored or a mark moved in this run: what separates a run that is catching up from one that is stuck. */
  moved = false;
  /** The listings read in this run, for the gap probe. */
  readonly listings: ListingRead[] = [];
  unlinkedOwnerReplies = 0;
  private readonly counts = new Map<string, StoredSummary>();

  add(o: { stored: number; summaries: readonly StoredSummary[]; unlinkedOwnerReplies: number }): void {
    this.stored += o.stored;
    this.unlinkedOwnerReplies += o.unlinkedOwnerReplies;
    for (const s of o.summaries) {
      const key = `${s.chat}|${s.source}`;
      this.counts.set(key, { ...s, count: (this.counts.get(key)?.count ?? 0) + s.count });
    }
  }

  summaries(): StoredSummary[] {
    return [...this.counts.values()];
  }
}

/** A run that must stop with this reason: the budget is spent, or a listing is broken. */
export class RunStopped extends Error {
  constructor(readonly reason: StoredReason) {
    super(reason);
  }
}

/** The 60-second budget of a run, checked before each provider request. */
export class RunBudget {
  constructor(
    private readonly clock: Clock,
    private readonly deadline: Instant,
    private readonly totals: RunTotals,
  ) {}

  check(): void {
    if (this.clock.now() >= this.deadline) throw new RunStopped(this.totals.moved ? "catching_up" : "timeout");
  }
}
