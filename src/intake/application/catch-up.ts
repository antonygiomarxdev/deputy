import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { CALLER_WAIT_MS, OVERLAP_MS, PAGE_SIZE, RUN_BUDGET_MS } from "../domain/constants";
import type { IntakeEvent } from "../domain/events";
import { SyncState, type StoredReason } from "../domain/sync-state";
import type { CatchUp } from "../ports/catch-up";
import type { EventPublisher } from "../ports/event-publisher";
import type { GetSyncStatus, SyncStatusView } from "../ports/get-sync-status";
import { LeaseLostError, type IntakeRepos, type IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import { ProviderError, type Cursor, type Provider } from "../ports/provider";
import type { RunCoordinator } from "./run-coordinator";
import type { StoreMessages } from "./store-messages";
import type { StorageFailureLog } from "./storage-failure-log";
import { readAll, RunBudget, RunStopped, RunTotals, sweepConversations, sweepOutbound } from "./sweeps";

export interface CatchUpDeps {
  provider: Provider;
  clock: Clock;
  lease: OwnerLease;
  uow: IntakeUnitOfWork;
  /** Reads outside any transaction. */
  reads: IntakeRepos;
  store: StoreMessages;
  publisher: EventPublisher;
  coordinator: RunCoordinator<RunResult>;
  status: GetSyncStatus;
  failures: StorageFailureLog;
}

/** Failure mapping (TP-03): provider kinds keep their name, a rate limit is usage_limit with its wait, anything else thrown is storage. */
function failureOf(e: unknown): { reason: StoredReason; retryAfterMs: number | null } {
  if (e instanceof RunStopped) return { reason: e.reason, retryAfterMs: null };
  if (e instanceof ProviderError) {
    return e.kind === "rate_limited"
      ? { reason: "usage_limit", retryAfterMs: e.retryAfterMs }
      : { reason: e.kind, retryAfterMs: null };
  }
  return { reason: "storage", retryAfterMs: null };
}

export type RunResult = { kind: "finished"; status: SyncStatusView; stored: number } | { kind: "refused"; reason: "not_owner" };
type Result = Awaited<ReturnType<CatchUp["execute"]>>;

export class CatchUpUseCase implements CatchUp {
  constructor(private readonly d: CatchUpDeps) {}

  async execute(q: { trigger: "start" | "timer" | "asked" | "retry"; waitMs?: number }): Promise<Result> {
    if (!(await this.d.lease.isOwner())) return { kind: "refused", reason: "not_owner" };
    const ran = await this.d.coordinator.run(() => this.run(), q.waitMs ?? CALLER_WAIT_MS);
    return ran.kind === "timeout" ? { kind: "still_running", status: await this.d.status.execute() } : ran.value;
  }

  private async run(): Promise<RunResult> {
    const { provider, clock, uow } = this.d;
    const signal = new AbortController().signal;
    const totals = new RunTotals();
    const now = clock.now();
    const budget = new RunBudget(clock, now + RUN_BUDGET_MS, totals);
    let state = SyncState.initial(provider.name);
    try {
      state = (await this.d.reads.syncState.load(provider.name)) ?? state;
      state.markAttempt(now);
      const from = state.props.markConversations === null ? null : state.props.markConversations - OVERLAP_MS;
      const fromOutbound = state.props.markOutbound === null ? null : state.props.markOutbound - OVERLAP_MS;

      const first = await provider.listConversations({ activeAfter: from, cursor: null, limit: PAGE_SIZE }, signal);
      budget.check();
      const providerNow = first.serverTime;
      state.begin({ providerTime: providerNow, now });
      // connectedAt is saved before anything is stored: the history rule reads it
      await uow.run((r) => r.syncState.save(state));

      const conversations = await readAll(
        first,
        (cursor: Cursor) => provider.listConversations({ activeAfter: from, cursor, limit: PAGE_SIZE }, signal),
        budget,
      );
      const sweep = { provider, uow, store: this.d.store, signal, totals, budget, state };
      await sweepConversations({ ...sweep, conversations, from });
      state.completeConversations(providerNow);
      await sweepOutbound({ ...sweep, from: fromOutbound, providerNow });

      const finishedAt = clock.now();
      state.complete(finishedAt);
      await uow.run(async (r) => {
        await r.syncState.save(state);
        const started = state.props.runStartedAt;
        if (started !== null) await r.rejections.resolveRecoverableBefore(started, finishedAt);
      });

      this.publish(totals, "complete", null, finishedAt);
      return { kind: "finished", status: await this.d.status.execute(), stored: totals.stored };
    } catch (e) {
      return this.failed(e, state, totals);
    }
  }

  /** A failed run keeps what it stored and its marks, records why, and says so like a finished one. */
  private async failed(e: unknown, state: SyncState, totals: RunTotals): Promise<RunResult> {
    if (e instanceof LeaseLostError) return { kind: "refused", reason: "not_owner" };
    const now = this.d.clock.now();
    const { reason, retryAfterMs } = failureOf(e);
    if (reason === "storage") this.d.failures.record(now);
    console.error(`deputy: catch-up stopped (${reason})`);
    state.fail(reason, now, retryAfterMs);
    try {
      await this.d.uow.run((r) => r.syncState.save(state));
    } catch (saveError) {
      if (saveError instanceof LeaseLostError) return { kind: "refused", reason: "not_owner" };
      this.d.failures.record(now);
      console.error("deputy: could not record the failed catch-up");
    }
    this.publish(totals, "failed", reason, now);
    return { kind: "finished", status: await this.d.status.execute(), stored: totals.stored };
  }

  /** Each event is published on its own: a subscriber that throws must not stop the next one. */
  private publish(totals: RunTotals, status: "complete" | "failed", reason: StoredReason | null, finishedAt: number): void {
    const { provider, publisher } = this.d;
    const summaries = totals.summaries();
    const events: IntakeEvent[] = [];
    if (summaries.length > 0) events.push({ name: "MessageStored", origin: "catch_up", items: summaries, at: finishedAt });
    if (totals.unlinkedOwnerReplies > 0) events.push({ name: "OwnerReplyUnlinked", at: finishedAt });
    events.push({
      name: "CatchUpFinished",
      provider: provider.name,
      status,
      reason,
      storedCount: totals.stored,
      finishedAt,
    });
    for (const e of events) {
      try {
        publisher.publish(e);
      } catch (err) {
        console.error(`deputy: a subscriber failed on ${e.name} (${err instanceof Error ? err.name : "unknown error"})`);
      }
    }
  }
}
