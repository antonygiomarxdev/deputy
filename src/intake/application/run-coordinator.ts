import type { Clock } from "../../shared/clock";

/** Single flight: one run at a time; a second caller waits for the one in flight and gets its result. */
export class RunCoordinator<T = unknown> {
  private current: Promise<T> | null = null;

  constructor(private readonly clock: Clock) {}

  get running(): boolean {
    return this.current !== null;
  }

  /** Starts `work` when none runs, otherwise awaits the running one. Gives up after waitMs; the run goes on. */
  async run(work: () => Promise<T>, waitMs: number): Promise<{ kind: "done"; value: T } | { kind: "timeout" }> {
    if (this.current === null) {
      const started = work().finally(() => {
        this.current = null;
      });
      this.current = started;
    }
    const joined = this.current;
    const outcome = await Promise.race([
      joined.then((value) => ({ kind: "done" as const, value })),
      this.clock.sleep(waitMs).then(() => ({ kind: "timeout" as const })),
    ]);
    return outcome;
  }

  /** CatchUpChat: waits for the run in flight, never starts one. */
  async waitIdle(waitMs: number): Promise<"idle" | "timeout"> {
    const joined = this.current;
    if (joined === null) return "idle";
    return Promise.race([
      joined.then(
        () => "idle" as const,
        () => "idle" as const,
      ),
      this.clock.sleep(waitMs).then(() => "timeout" as const),
    ]);
  }
}
