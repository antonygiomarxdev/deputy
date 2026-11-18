CREATE TABLE outgoing (
  send_id        TEXT PRIMARY KEY CHECK (length(send_id) BETWEEN 1 AND 100),
  chat_id        TEXT    NOT NULL,
  text           TEXT    NOT NULL,
  parts_total    INTEGER NOT NULL CHECK (parts_total >= 1),
  state          TEXT    NOT NULL CHECK (state IN ('pending','sent','failed','unknown')),
  failure_reason TEXT,
  created_at     INTEGER NOT NULL,
  finished_at    INTEGER
);

CREATE TABLE outgoing_parts (
  send_id             TEXT    NOT NULL REFERENCES outgoing (send_id),
  part                INTEGER NOT NULL,
  text                TEXT    NOT NULL,
  provider            TEXT,
  provider_message_id TEXT,
  state               TEXT    NOT NULL CHECK (state IN ('pending','sent','failed','unknown')),
  PRIMARY KEY (send_id, part),
  UNIQUE (provider, provider_message_id)
);

CREATE TABLE source_changes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  at                  INTEGER NOT NULL,
  provider            TEXT    NOT NULL,
  provider_message_id TEXT    NOT NULL,
  from_source         TEXT    NOT NULL,
  to_source           TEXT    NOT NULL,
  send_id             TEXT    NOT NULL
);
