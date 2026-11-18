import { LEASE_TTL_MS } from "../../src/shared/lease-constants";
import type { Clock } from "../../src/shared/clock";
import type { LeaseControl } from "../../src/shared/owner-lease";

export interface LeaseHolder {
  token: string | null;
  heartbeat: number;
}

/** Instances sharing one holder object model separate processes on one database. */
export class InMemoryOwnerLease implements LeaseControl {
  constructor(
    private readonly holder: LeaseHolder,
    private readonly clock: Clock,
    private readonly token: string,
  ) {}

  async isOwner(): Promise<boolean> {
    return this.holder.token === this.token;
  }

  async tryAcquire(): Promise<boolean> {
    const now = this.clock.now();
    const free = this.holder.token === null || this.holder.heartbeat === 0 || this.holder.heartbeat < now - LEASE_TTL_MS;
    if (this.holder.token === this.token || free) {
      this.holder.token = this.token;
      this.holder.heartbeat = now;
      return true;
    }
    return false;
  }

  async renew(): Promise<boolean> {
    if (this.holder.token !== this.token) return false;
    this.holder.heartbeat = this.clock.now();
    return true;
  }

  async release(): Promise<void> {
    if (this.holder.token === this.token) this.holder.heartbeat = 0;
  }
}
