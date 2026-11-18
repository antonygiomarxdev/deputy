import type { Clock } from "../../../shared/clock";
import type { Instant } from "../../../shared/instant";
import { PACE_MARGIN_MS, READ_RESERVE } from "../../domain/constants";

const MINUTE_MS = 60_000;

/**
 * The plan limit is counted per fixed minute of the provider clock. Reads keep READ_RESERVE requests of it for sends: when the last
 * answer said fewer were left, the next read waits for the next whole provider minute plus a margin (the Date header has whole-second
 * resolution). Sends never wait.
 */
export class Pacer {
  private last: { remaining: number | null; serverTime: Instant; at: Instant } | null = null;

  constructor(private readonly clock: Clock) {}

  /** After every response. */
  observe(r: { remaining: number | null; serverTime: Instant }): void {
    this.last = { remaining: r.remaining, serverTime: r.serverTime, at: this.clock.now() };
  }

  /** Reads call this first. Afterwards `remaining` is forgotten: the new minute starts with a full count. */
  async beforeRead(): Promise<void> {
    const last = this.last;
    if (last === null || last.remaining === null || last.remaining >= READ_RESERVE) return;
    // the provider clock moves with the local one between responses
    const providerNow = last.serverTime + (this.clock.now() - last.at);
    await this.clock.sleep(MINUTE_MS - (providerNow % MINUTE_MS) + PACE_MARGIN_MS);
    this.last = null;
  }
}
