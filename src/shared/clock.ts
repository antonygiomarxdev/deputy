import type { Instant } from "./instant";

export interface Clock {
  now(): Instant;
  /** Use cases never call setTimeout. */
  sleep(ms: number): Promise<void>;
}
