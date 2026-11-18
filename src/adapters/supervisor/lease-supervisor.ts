import type { Clock } from "../../shared/clock";
import { LEASE_RENEW_MS } from "../../shared/lease-constants";
import type { LeaseControl } from "../../shared/owner-lease";

export interface LeaseSupervisorDeps {
  lease: LeaseControl;
  clock: Clock;
  /** Runs recovery, then starts the scheduler and the listener. It runs as its own task, after acquisition and outside the renew loop; it only starts the scheduler and the listener and returns, so recurring work never runs inside it. Recovery re-checks `lease.isOwner()` before each write it makes. On a throw the supervisor logs to stderr and starts it again at the next tick. */
  onAcquired(): Promise<void>;
  /** Stops the scheduler and the listener. */
  onLost(): Promise<void>;
  /** Recurring work. Called after each renewal while this process is the owner; a throw goes to stderr and the next tick calls it again. */
  onTick?(): Promise<void>;
}

export class LeaseSupervisor {
  private stopped = false;
  private owner = false;
  private acquiring: Promise<void> | null = null;

  constructor(private readonly d: LeaseSupervisorDeps) {}

  get isOwner(): boolean {
    return this.owner;
  }

  /** Tries once at once, then every LEASE_RENEW_MS. The tick renews the lease even while `onAcquired` still runs (recovery can outlast the 30 s TTL). */
  start(): void {
    void this.loop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.owner) {
      this.owner = false;
      await this.safely("onLost", () => this.d.onLost());
    }
    await this.safely("release", () => this.d.lease.release());
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      await this.safely("tick", () => this.tick());
      if (this.stopped) return;
      await this.d.clock.sleep(LEASE_RENEW_MS);
    }
  }

  private async tick(): Promise<void> {
    const held = await this.d.lease.tryAcquire();
    if (this.stopped) return;
    if (!held) {
      if (this.owner) {
        this.owner = false;
        await this.safely("onLost", () => this.d.onLost());
      }
      return;
    }
    if (!this.owner && this.acquiring === null) this.acquiring = this.acquire();
    const onTick = this.d.onTick;
    if (this.owner && onTick !== undefined) await this.safely("onTick", () => onTick.call(this.d));
  }

  private async acquire(): Promise<void> {
    try {
      await this.d.onAcquired();
      // The lease may have moved on while onAcquired ran, or stop() may have been called; what it started must then be stopped.
      this.owner = !this.stopped && (await this.d.lease.isOwner());
      if (!this.owner) await this.safely("onLost", () => this.d.onLost());
    } catch (e) {
      console.error("deputy: onAcquired failed, trying again at the next tick:", e);
    } finally {
      this.acquiring = null;
    }
  }

  private async safely(what: string, f: () => Promise<void>): Promise<void> {
    try {
      await f();
    } catch (e) {
      console.error(`deputy: lease supervisor ${what} failed:`, e);
    }
  }
}
