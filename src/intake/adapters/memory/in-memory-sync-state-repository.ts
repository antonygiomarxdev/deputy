import type { Instant } from "../../../shared/instant";
import { SyncState } from "../../domain/sync-state";
import type { SyncStateRepository } from "../../ports/sync-state-repository";
import type { State } from "./in-memory-state";

export function inMemorySyncRepository(s: () => State): SyncStateRepository {
  const later = (a: Instant | null, b: Instant | null): Instant | null => (a === null ? b : b === null ? a : Math.max(a, b));
  return {
    async connectedAt(p) {
      return s().sync.get(p)?.connectedAt ?? null;
    },
    async markLiveVerified(p, at) {
      s().sync.set(p, { ...(s().sync.get(p) ?? SyncState.initial(p).props), liveVerifiedAt: at });
    },
    async liveVerifiedAt(p) {
      return s().sync.get(p)?.liveVerifiedAt ?? null;
    },
    async load(p) {
      const row = s().sync.get(p);
      return row === undefined ? null : SyncState.rehydrate(row);
    },
    async save(state) {
      const n = state.props;
      const old = s().sync.get(n.provider);
      s().sync.set(n.provider, {
        ...n,
        connectedAt: old?.connectedAt ?? n.connectedAt,
        markConversations: later(old?.markConversations ?? null, n.markConversations),
        markOutbound: later(old?.markOutbound ?? null, n.markOutbound),
        liveVerifiedAt: old?.liveVerifiedAt ?? null,
      });
    },
  };
}
