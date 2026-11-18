import type { Clock } from "../../../shared/clock";
import { DEFAULT_PERIOD_MINUTES } from "../../domain/constants";
import type { CatchUp } from "../../ports/catch-up";
import type { GetIntakeSettings } from "../../ports/get-intake-settings";

const MINUTE_MS = 60_000;

type Trigger = "start" | "timer" | "asked" | "retry";

/**
 * Runs `CatchUp` once at start and then on a loop: after a rate limit at the time the provider named, while a run is still
 * catching up at once, otherwise every `catchUpMinutes` (read again before each wait). A run that throws is logged and the loop goes on.
 */
export class CatchUpScheduler {
  private stopped = true;
  private loop: Promise<void> | null = null;

  constructor(
    private readonly d: {
      catchUp: CatchUp;
      settings: GetIntakeSettings;
      clock: Clock;
    },
  ) {}

  start(): void {
    if (this.loop !== null && !this.stopped) return;
    this.stopped = false;
    this.loop = this.run();
  }

  /** Returns at once; the loop ends at its next wake. A run in flight is guarded by the lease check at every page. */
  stop(): void {
    this.stopped = true;
  }

  private async run(): Promise<void> {
    let trigger: Trigger = "start";
    while (!this.stopped) {
      let wait: { ms: number; next: Trigger };
      try {
        wait = await this.afterRun(await this.d.catchUp.execute({ trigger }));
      } catch (e) {
        console.error(`deputy: a catch-up run failed (${e instanceof Error ? e.name : "unknown error"})`);
        wait = await this.period().catch(() => ({ ms: DEFAULT_PERIOD_MINUTES * MINUTE_MS, next: "timer" as const }));
      }
      if (wait.ms > 0) await this.d.clock.sleep(wait.ms);
      trigger = wait.next;
    }
  }

  private async afterRun(result: Awaited<ReturnType<CatchUp["execute"]>>): Promise<{ ms: number; next: Trigger }> {
    if (result.kind === "finished") {
      // a complete status has no reason, so only a failed run waits for a retry
      const { reason, retryAt } = result.status;
      if (reason === "usage_limit" && retryAt !== null) return { ms: retryAt - this.d.clock.now(), next: "retry" };
      if (reason === "catching_up") return { ms: 0, next: "retry" };
    }
    return this.period();
  }

  private async period(): Promise<{ ms: number; next: Trigger }> {
    const { catchUpMinutes } = await this.d.settings.execute();
    return { ms: catchUpMinutes * MINUTE_MS, next: "timer" };
  }
}
