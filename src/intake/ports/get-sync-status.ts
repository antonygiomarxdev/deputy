import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";
import type { SyncReason } from "../domain/sync-state";

export interface SyncStatusView {
  provider: ProviderName;
  status: "complete" | "failed";
  reason: SyncReason | null;
  /** Empty when the status is complete. */
  reasonText: string;
  running: boolean;
  lastAttemptAt: Instant | null;
  lastSuccessAt: Instant | null;
  newestStoredAt: Instant | null;
  oldestStoredAt: Instant | null;
  failedSince: Instant | null;
  retryAt: Instant | null;
  tellOwner: boolean;
  gap: { storedAt: Instant; returnedAt: Instant } | null;
  /** First success happened, firstImportCount is 0 and newestStoredAt is null. */
  historyMaybeSyncing: boolean;
  catchUpMinutes: number;
  /** StorageFailureLog. */
  storageFailureAt: Instant | null;
  lastLiveDeliveryVerifiedAt: Instant | null;
}

/** A pure read: it never asks for the lease. */
export interface GetSyncStatus {
  execute(): Promise<SyncStatusView>;
}
