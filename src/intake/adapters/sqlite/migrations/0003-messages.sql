CREATE TABLE messages (
  seq                 INTEGER PRIMARY KEY AUTOINCREMENT,
  provider            TEXT    NOT NULL CHECK (provider IN ('kapso','dev')),
  provider_message_id TEXT    NOT NULL CHECK (provider_message_id <> ''),
  chat_id             TEXT    NOT NULL,
  conversation_ref    TEXT,
  sender              TEXT,
  provider_sender     TEXT,                 -- the sender id as the provider sent it (L8)
  type                TEXT    NOT NULL,
  readable            INTEGER NOT NULL CHECK (readable IN (0,1)),
  text                TEXT,
  text_norm           TEXT,
  transcript          TEXT,
  sent_at             INTEGER NOT NULL,
  stored_at           INTEGER NOT NULL,
  origin              TEXT,
  source              TEXT    NOT NULL CHECK (source IN ('customer','owner_app','sent_through_deputy')),
  mark                TEXT    NOT NULL DEFAULT 'normal'
                      CHECK (mark IN ('normal','group_chat','sender_unknown','not_attributable')),
  history             INTEGER NOT NULL CHECK (history IN (0,1)),
  dev                 INTEGER NOT NULL CHECK (dev IN (0,1)),
  edited              INTEGER NOT NULL DEFAULT 0,
  deleted_by_sender   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (provider, provider_message_id)
);
CREATE INDEX messages_chat   ON messages (chat_id, dev, sent_at, seq);
CREATE INDEX messages_conv   ON messages (conversation_ref, sent_at);
CREATE INDEX messages_newest ON messages (provider, sent_at);
CREATE INDEX messages_text_norm ON messages (text_norm) WHERE source = 'customer' AND text_norm IS NOT NULL;

CREATE TABLE message_versions (
  provider            TEXT    NOT NULL,
  provider_message_id TEXT    NOT NULL,
  version             INTEGER NOT NULL,
  text                TEXT,
  replaced_at         INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_message_id, version),
  FOREIGN KEY (provider, provider_message_id) REFERENCES messages (provider, provider_message_id)
);

CREATE TABLE chats (
  chat_id                  TEXT    NOT NULL,
  dev                      INTEGER NOT NULL CHECK (dev IN (0,1)),
  mark                     TEXT    NOT NULL DEFAULT 'normal',
  conversation_ref         TEXT,
  provider_id              TEXT,                 -- first counterpart id seen, as the provider sent it; the destination of a send (L8)
  last_customer_at         INTEGER,
  last_customer_message_id TEXT,
  last_answer_at           INTEGER,
  last_answer_source       TEXT CHECK (last_answer_source IN ('owner_app','sent_through_deputy')),
  last_unattributed_at     INTEGER,
  profile_name             TEXT,                 -- untrusted display hint, at most 80 graphemes (D28)
  updated_at               INTEGER NOT NULL,
  PRIMARY KEY (chat_id, dev)
);

CREATE TABLE rejections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  reason      TEXT    NOT NULL CHECK (reason IN
              ('bad_signature','missing_signature','no_secret','no_identifier','malformed','dev_entry_refused')),
  recoverable INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER
);
CREATE TABLE rejection_pruned (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  count         INTEGER NOT NULL,
  last_prune_at INTEGER
);
INSERT INTO rejection_pruned (id, count, last_prune_at) VALUES (1, 0, NULL);
