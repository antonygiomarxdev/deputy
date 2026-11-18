import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";
import type { SyncState } from "../domain/sync-state";

export interface SyncStateRepository {
  /** Written by SPEC-03; null before the first catch-up. */
  connectedAt(provider: ProviderName): Promise<Instant | null>;
  markLiveVerified(provider: ProviderName, at: Instant): Promise<void>;
  liveVerifiedAt(provider: ProviderName): Promise<Instant | null>;
  /** Null for a provider with no row. A row made by markLiveVerified alone loads as "not yet run". */
  load(provider: ProviderName): Promise<SyncState | null>;
  /**
   * Upsert. mark_conversations and mark_outbound are written as the later of old and new, and connected_at keeps the first value,
   * so a stale in-memory state never moves a mark back. live_verified_at is never overwritten by save.
   */
  save(s: SyncState): Promise<void>;
}
