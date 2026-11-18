import type { Clock } from "../../src/shared/clock";
import type { Instant } from "../../src/shared/instant";

export class FakeClock implements Clock {
  private sleepers: { due: Instant; resolve: () => void }[] = [];

  constructor(private time: Instant = 0) {}

  now(): Instant {
    return this.time;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.sleepers.push({ due: this.time + ms, resolve });
    });
  }

  /** Resolves due sleeps in order of due time, letting each continuation run before the next. */
  async advance(ms: number): Promise<void> {
    const target = this.time + ms;
    for (;;) {
      const next = this.sleepers.filter((s) => s.due <= target).sort((a, b) => a.due - b.due)[0];
      if (!next) break;
      this.sleepers = this.sleepers.filter((s) => s !== next);
      this.time = next.due;
      next.resolve();
      await new Promise((r) => setTimeout(r, 0));
    }
    this.time = target;
  }
}
