import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";
import { reasonText } from "../domain/status-text";
import { SyncState } from "../domain/sync-state";
import type { SyncStatusView } from "../ports/get-sync-status";

export function buildSyncStatusView(i: {
  provider: ProviderName;
  state: SyncState | null;
  running: boolean;
  newestStoredAt: Instant | null;
  oldestStoredAt: Instant | null;
  catchUpMinutes: number;
  storageFailureAt: Instant | null;
  now: Instant;
}): SyncStatusView {
  const state = i.state ?? SyncState.initial(i.provider);
  const p = state.props;
  // a failed attempt with no recorded reason is one that could not write its own failure
  const reason = state.isNotYetRun() ? "not_yet_run" : p.status === "complete" ? null : (p.reason ?? "storage");
  return {
    provider: i.provider,
    status: state.isNotYetRun() ? "failed" : p.status,
    reason,
    reasonText: reason === null ? "" : reasonText(reason, { newestStoredAt: i.newestStoredAt, gap: p.gap }),
    running: i.running,
    lastAttemptAt: p.lastAttemptAt,
    lastSuccessAt: p.lastSuccessAt,
    newestStoredAt: i.newestStoredAt,
    oldestStoredAt: i.oldestStoredAt,
    failedSince: p.failedSince,
    retryAt: p.retryAt,
    tellOwner: state.isNotYetRun() ? false : state.tellOwner(i.now),
    gap: p.gap,
    historyMaybeSyncing: p.lastSuccessAt !== null && p.firstImportCount === 0 && i.newestStoredAt === null,
    catchUpMinutes: i.catchUpMinutes,
    storageFailureAt: i.storageFailureAt,
    lastLiveDeliveryVerifiedAt: p.liveVerifiedAt,
  };
}
