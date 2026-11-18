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
  proposed_norm           TEXT NOT NULL,
  current_norm            TEXT NOT NULL,
  text_version            INTEGER NOT NULL DEFAULT 1,
  shown_version           INTEGER,
  revision                INTEGER NOT NULL DEFAULT 1,
  made_at                 TEXT NOT NULL,
  answers_message_id      TEXT,
  dev                     INTEGER NOT NULL DEFAULT 0,
  basis_message_id        TEXT NOT NULL,
  basis_sent_at           TEXT NOT NULL,
  checked_sent_at         TEXT NOT NULL,
  checked_stored_at       TEXT NOT NULL,
  pending_choice          INTEGER NOT NULL DEFAULT 0,
  hold_reason             TEXT,
  fail_reason             TEXT,
  order_payload           TEXT,
  order_id                TEXT,
  replaced_by             INTEGER REFERENCES drafts(number) DEFERRABLE INITIALLY DEFERRED,
  closed_at               TEXT,
  retry_at                TEXT,
  attempts                INTEGER NOT NULL DEFAULT 0,
  CHECK (kind = 'order' OR (order_payload IS NULL AND order_id IS NULL))
);
CREATE UNIQUE INDEX drafts_one_open
  ON drafts (chat, kind)
  WHERE state IN ('waiting','held','failed','unknown','sending','recording');
CREATE INDEX drafts_by_state ON drafts (state);
