import type { SqlExecutor } from "./sql-database";

export interface OwnerLease {
  /** Reads the lease row and compares the token. With `within`, reads inside that transaction. */
  isOwner(within?: SqlExecutor): Promise<boolean>;
}

export interface LeaseControl extends OwnerLease {
  /** Takes the lease when it is free or expired, renews it when held. True when this process owns it afterwards. */
  tryAcquire(): Promise<boolean>;
  /** False when the token is no longer ours. */
  renew(): Promise<boolean>;
  /** Clears the heartbeat when the token is ours. */
  release(): Promise<void>;
}
