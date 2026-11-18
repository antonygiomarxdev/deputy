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
  live_verified_at   INTEGER                  -- local clock; set only after a live signature check passed
);
