# TP-03-catch-up-and-history: Information

Part of [TP-03-catch-up-and-history.md](../tp/TP-03-catch-up-and-history.md). Moved verbatim from there; nothing changed.

## Information

```sql
CREATE TABLE catchup_status (
  provider           TEXT PRIMARY KEY CHECK (provider IN ('kapso','dev')),
  status             TEXT NOT NULL CHECK (status IN ('complete','failed')),
  reason             TEXT CHECK (reason IN ('unreachable','credentials','quota','usage_limit','timeout',
                       'bad_response','possible_gap','catching_up','storage')),
  last_attempt_at    INTEGER,                 -- local clock
  last_success_at    INTEGER,                 -- local clock
  run_started_at     INTEGER,                 -- local clock, for resolving rejection notes
  connected_at       INTEGER,                 -- provider clock, set once
  mark_conversations INTEGER,                 -- provider clock
  mark_outbound      INTEGER,                 -- provider clock
  outbound_resume    TEXT,                    -- JSON {cursor, from, runStart} or NULL
  failed_since       INTEGER,
  rate_limited_since INTEGER,
  retry_at           INTEGER,
  gap_stored_at      INTEGER,
  gap_returned_at    INTEGER,
  first_import_count INTEGER NOT NULL DEFAULT 0,
  live_verified_at   INTEGER                  -- local clock; set only after a live signature check passed,
  finished_at        INTEGER                  -- local clock; set when a run's end is saved, cleared when a run begins; null after a crash (migration 0007)
);

CREATE TABLE settings (          -- shared table, one owner slice per key (cross-cutting Information)
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  changed_at INTEGER NOT NULL
);
-- Intake's key: 'catch_up_minutes' (integer, 1 or more, default 2 when absent)
```

Rules: `mark_*` and `connected_at` are provider times; `last_*` times are local, because they only say when Deputy last looked. Order of messages never depends on the local clock (FR-INTAKE-03 edge case). `GetSyncStatus` computes `newestStoredAt` and `oldestStoredAt` from `messages` (non-dev, same provider). The table never holds provider error text.

Port:

```ts
export interface SyncStateRepository {
  load(provider: ProviderName): Promise<SyncState | null>;
  save(s: SyncState): Promise<void>;
}
export interface MessageRepositoryGap {   // added to MessageRepository (TP-02)
  /** Newest stored time in scope that is older than `before`, or null. Non-dev, same provider. */
  newestStoredBefore(
    provider: ProviderName,
    scope: { conversationRef: string } | { ownerOrDeputy: true },
    before: Instant,
  ): Promise<Instant | null>;
  newestStoredAt(provider: ProviderName): Promise<Instant | null>;
  oldestStoredAt(provider: ProviderName): Promise<Instant | null>;
}
export interface IntakeSettingsRepository {
  getCatchUpMinutes(): Promise<number>;                 // default 2
  setCatchUpMinutes(n: number): Promise<void>;
}
```
