# TP-01-draft-lifecycle: Information

Part of [TP-01-draft-lifecycle.md](../tp/TP-01-draft-lifecycle.md). Moved verbatim from there; nothing changed.

## Information

Tables owned by the slice for FRD-01 (the full `drafts` table; TP-02 adds `approvals`, TP-04 adds `drafts_log`). Times are ISO-8601 UTC text.

```sql
CREATE TABLE draft_counter (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  last INTEGER NOT NULL
);
INSERT INTO draft_counter (id, last) VALUES (1, 0);

CREATE TABLE drafts (
  number                  INTEGER PRIMARY KEY,
  kind                    TEXT NOT NULL CHECK (kind IN ('reply','order')),
  chat                    TEXT NOT NULL,
  state                   TEXT NOT NULL CHECK (state IN
    ('waiting','held','sending','recording','sent','recorded','failed','unknown','rejected','replaced')),
  proposed_text           TEXT NOT NULL,
  current_text            TEXT NOT NULL,
  proposed_norm           TEXT NOT NULL,   -- normalized copy, for the copied-words check (TP-02)
  current_norm            TEXT NOT NULL,
  text_version            INTEGER NOT NULL DEFAULT 1,
  shown_version           INTEGER,         -- last text_version returned by list_drafts
  revision                INTEGER NOT NULL DEFAULT 1,
  made_at                 TEXT NOT NULL,
  answers_message_id      TEXT,
  dev                     INTEGER NOT NULL DEFAULT 0,   -- the world the draft was made in (Intake's dev flag)
  basis_message_id        TEXT NOT NULL,
  basis_sent_at           TEXT NOT NULL,
  checked_sent_at         TEXT NOT NULL,   -- TP-03: moves at a hold
  checked_stored_at       TEXT NOT NULL,
  pending_choice          INTEGER NOT NULL DEFAULT 0,
  hold_reason             TEXT,
  fail_reason             TEXT,
  order_payload           TEXT,
  order_id                TEXT,
  replaced_by             INTEGER REFERENCES drafts(number),
  closed_at               TEXT,
  CHECK (kind = 'order' OR (order_payload IS NULL AND order_id IS NULL))
);
CREATE UNIQUE INDEX drafts_one_open
  ON drafts (chat, kind)
  WHERE state IN ('waiting','held','failed','unknown','sending','recording');
CREATE INDEX drafts_by_state ON drafts (state);
```

Notes.
- The `state` list has no "approved" because it is never stored.
- `WaitingChats` returns `made_at` as the time written and reads only rows in an open state.
- Order drafts keep their summary in `current_text` and the payload in `order_payload`. Both are personal data and are replaced when the order is deleted (TP-04).
