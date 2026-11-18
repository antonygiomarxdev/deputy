import type { Clock } from "../../shared/clock";
import type { Instant } from "../../shared/instant";

export class SystemClock implements Clock {
  now(): Instant {
    return Date.now();
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
