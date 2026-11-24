# TP-01-guided-flow: Information

Part of [TP-01-guided-flow.md](../tp/TP-01-guided-flow.md). Moved verbatim from there; nothing changed.

## Information

Tables owned by Setup (the cross-cutting TP names `setup_progress`; the others hold what a progress row cannot):

```sql
CREATE TABLE setup_run (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  mode                 TEXT NOT NULL CHECK (mode IN ('test','real')),
  agent                TEXT CHECK (agent IN ('claude-code','codex','cursor','gemini-cli','other')),
  first_instruction_at TEXT,                 -- UTC ISO-8601; set once
  completed_at         TEXT,
  superseded_by        INTEGER REFERENCES setup_run(id)
);
CREATE TABLE setup_progress (
  run_id        INTEGER NOT NULL REFERENCES setup_run(id),
  step          TEXT NOT NULL CHECK (step IN ('install','costs','connect','credentials','profile','test')),
  state         TEXT NOT NULL CHECK (state IN ('todo','done','skipped','recheck')),
  started_at    TEXT,
  passed_at     TEXT,
  checked_at    TEXT,
  check_passed  INTEGER CHECK (check_passed IN (0,1)),
  reason_code   TEXT,                        -- fixed code, never provider text (D20)
  reason_params TEXT,                        -- JSON of numbers and fixed names only
  PRIMARY KEY (run_id, step)
);
CREATE TABLE setup_activity (
  run_id INTEGER NOT NULL REFERENCES setup_run(id),
  at     TEXT NOT NULL
);
CREATE TABLE setup_provider_wait (
  run_id     INTEGER NOT NULL REFERENCES setup_run(id),
  kind       TEXT NOT NULL CHECK (kind IN ('connect','delivery','live')),
  started_at TEXT NOT NULL,
  ended_at   TEXT,
  PRIMARY KEY (run_id, kind, started_at)
);
CREATE TABLE setup_fact (                    -- append-only facts of TP-02 to TP-04
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      INTEGER NOT NULL REFERENCES setup_run(id),
  kind        TEXT NOT NULL,                 -- fixed list in the domain
  at          TEXT NOT NULL,
  value       TEXT,                          -- a code or a short fixed value, never a secret
  owner_words TEXT
);
```

`reason_params` and `value` never hold a secret (TP-03, TD-3 there refuses words that contain one). `state` stores `done` and `todo`; "current" is derived (TD-1). All times are UTC.
