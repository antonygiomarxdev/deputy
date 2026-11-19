import type { Clock } from "../shared/clock";
import type { LeaseControl } from "../shared/owner-lease";
import type { ProviderName } from "../shared/provider-name";
import { LeaseSupervisor } from "../adapters/supervisor/lease-supervisor";
import type { LiveListener } from "../intake/adapters/http/listener";
import type { CatchUpScheduler } from "../intake/adapters/scheduler/catch-up-scheduler";
import type { ApplyPendingChanges, IntakeRuntime } from "../intake/index";
import { ownerHooks } from "../composition/owner-hooks";
import type { createApprovals } from "../drafts/index";
import type { Settings } from "./settings";

/** The lease supervisor: what this process does when it becomes the owner, each tick, and when it loses the lease. */
export function superviseLease(d: {
  lease: LeaseControl;
  clock: Clock;
  settings: Settings;
  providerName: ProviderName;
  intake: IntakeRuntime;
  scheduler: CatchUpScheduler;
  listener: LiveListener;
  listens: boolean;
  ownerNumbers: { applyPendingChanges: ApplyPendingChanges };
  approvals: Pick<ReturnType<typeof createApprovals>, "retryPendingOutcomes">;
}): LeaseSupervisor {
  const hooks = ownerHooks({
    markInterruptedSends: () => d.intake.markInterruptedSends.execute(),
    listener: d.listener,
    listens: d.listens,
    scheduler: d.scheduler,
    ownerLine: `deputy: owner of ${d.settings.dataDir} (config ${d.settings.configDir}, provider ${d.providerName})`,
    log: (line) => console.error(line),
  });
  return new LeaseSupervisor({
    lease: d.lease,
    clock: d.clock,
    onAcquired: hooks.onAcquired,
    onLost: hooks.onLost,
    // every tick while this process owns the data: owner-number changes the terminal left pending, and `sent` records
    // that could not be written (retried here, never by sending again)
    onTick: async () => {
      try {
        await d.ownerNumbers.applyPendingChanges.execute();
      } finally {
        await d.approvals.retryPendingOutcomes.run();
      }
    },
  });
}

/** Resolves once stdin ends, a SIGINT or a SIGTERM arrives, and the supervisor has stopped; then closes the database. */
export function untilShutdown(supervisor: Pick<LeaseSupervisor, "stop">, db: { close(): void }): Promise<void> {
  let stopping: Promise<void> | null = null;
  return new Promise<void>((resolve) => {
    const shutdown = () => {
      stopping ??= supervisor.stop().finally(() => {
        db.close();
        resolve();
      });
    };
    process.stdin.once("end", shutdown);
    process.stdin.once("close", shutdown);
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}
