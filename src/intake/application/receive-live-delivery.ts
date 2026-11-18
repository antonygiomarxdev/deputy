import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import type { IntakeEvent } from "../domain/events";
import type { Secret } from "../domain/secret";
import type { RejectionReason } from "../domain/rejection-note";
import type { EventPublisher } from "../ports/event-publisher";
import { LeaseLostError, type IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import type { Provider } from "../ports/provider";
import type { ReceiveLiveDelivery } from "../ports/receive-live-delivery";
import type { StorageFailureLog } from "./storage-failure-log";
import type { StoredSummary, StoreMessages } from "./store-messages";

export interface ReceiveLiveDeliveryDeps {
  lease: OwnerLease;
  provider: Provider;
  /** The resolved receiving mode; dev ignores it (dev entry points are always on). */
  receiving: "catch_up" | "live";
  /** The Kapso webhook secret, or null when none is configured. */
  webhookSecret: Secret | null;
  unitOfWork: IntakeUnitOfWork;
  store: StoreMessages;
  events: EventPublisher;
  clock: Clock;
  failures: StorageFailureLog;
}

type Result = Awaited<ReturnType<ReceiveLiveDelivery["execute"]>>;

export class ReceiveLiveDeliveryUseCase implements ReceiveLiveDelivery {
  constructor(private readonly d: ReceiveLiveDeliveryDeps) {}

  async execute(req: { rawBody: Uint8Array; headers: ReadonlyMap<string, string> }): Promise<Result> {
    const { provider, unitOfWork: uow } = this.d;
    if (!(await this.d.lease.isOwner())) return { kind: "refused", reason: "not_owner" };
    if (provider.name !== "dev" && this.d.receiving !== "live") return { kind: "live_off" };

    const parsed = provider.verifyAndParse({ rawBody: req.rawBody, headers: req.headers, secret: this.d.webhookSecret?.reveal() ?? null });
    try {
      if (parsed.kind !== "ok") {
        const reason: RejectionReason = parsed.kind;
        await uow.run((r) => r.rejections.add(this.d.clock.now(), reason, false));
        return { kind: "rejected", reason };
      }
      // only a delivery whose signature passed counts as live proof (catch-up never sets it)
      await uow.run((r) => r.syncState.markLiveVerified(provider.name, this.d.clock.now()));
      const outcome = await uow.run((r) => this.d.store.store(r, { provider: provider.name, events: parsed.events }));
      this.publish(outcome.summaries, outcome.unlinkedOwnerReplies);
      return { kind: "stored", stored: outcome.stored, duplicates: outcome.duplicates, ignored: outcome.ignored };
    } catch (e) {
      if (e instanceof LeaseLostError) return { kind: "refused", reason: "not_owner" };
      this.d.failures.record(this.d.clock.now());
      console.error(`deputy: storing a live delivery failed (${e instanceof Error ? e.name : "unknown error"})`);
      return { kind: "storage_failed" };
    }
  }

  // The commit is done: a subscriber that throws must not undo or fail the store, and must not
  // skip the next event (D30 holds every send on OwnerReplyUnlinked).
  private publish(items: readonly StoredSummary[], unlinked: number): void {
    const at = this.d.clock.now();
    const events: IntakeEvent[] = [];
    if (items.length > 0) events.push({ name: "MessageStored", origin: "live", items, at });
    if (unlinked > 0) events.push({ name: "OwnerReplyUnlinked", at });
    for (const e of events) {
      try {
        this.d.events.publish(e);
      } catch (err) {
        console.error(`deputy: an event subscriber failed (${err instanceof Error ? err.name : "unknown error"})`);
      }
    }
  }
}
