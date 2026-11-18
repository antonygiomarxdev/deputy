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
      if (this.auto) this.pump();
    });
  }

  private auto = false;
  private pumping = false;

  /**
   * Time passes by itself: when the program is idle (every microtask done) and something sleeps, the clock jumps to the earliest
   * sleeper. Work that only waits on fake time therefore finishes without the test pumping `advance`.
   */
  // shortcut: idle is detected with a setTimeout(0) macrotask, so it can fire while real I/O (a socket, a file, a child process) is
  // still pending and jump the clock too early. Use autoAdvance only with fully fake adapters; when a test mixes real I/O with a
  // fake clock, drive time with advance() instead.
  autoAdvance(on = true): void {
    this.auto = on;
    if (on) this.pump();
  }

  private pump(): void {
    if (this.pumping) return;
    this.pumping = true;
    setTimeout(() => {
      this.pumping = false;
      const next = [...this.sleepers].sort((a, b) => a.due - b.due)[0];
      if (!next || !this.auto) return;
      this.sleepers = this.sleepers.filter((s) => s !== next);
      this.time = Math.max(this.time, next.due);
      next.resolve();
      this.pump();
    }, 0);
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
