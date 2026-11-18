CREATE TABLE approvals (
  id            TEXT PRIMARY KEY,
  draft_number  INTEGER NOT NULL REFERENCES drafts(number),
  text_version  INTEGER NOT NULL,
  text          TEXT NOT NULL,
  text_hash     TEXT NOT NULL,
  owner_words   TEXT NOT NULL,
  approved_at   TEXT NOT NULL,
  used_at       TEXT NOT NULL,
  send_id       TEXT NOT NULL UNIQUE,
  voided_at     TEXT,
  void_reason   TEXT
);
CREATE INDEX approvals_by_draft ON approvals (draft_number);
