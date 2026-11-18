import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";

export interface SyncStateRepository {
  /** Written by SPEC-03; null before the first catch-up. */
  connectedAt(provider: ProviderName): Promise<Instant | null>;
  markLiveVerified(provider: ProviderName, at: Instant): Promise<void>;
  liveVerifiedAt(provider: ProviderName): Promise<Instant | null>;
}
