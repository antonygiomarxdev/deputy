-- What the dev provider "holds" at its side. Catch-up lists it like a provider listing.
CREATE TABLE dev_holdings (
  seq                 INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_message_id TEXT    NOT NULL UNIQUE,
  conversation_ref    TEXT,
  counterpart         TEXT,
  sender              TEXT,
  direction           TEXT    NOT NULL CHECK (direction IN ('inbound','outbound')),
  type                TEXT    NOT NULL,
  text                TEXT,
  transcript          TEXT,
  origin              TEXT,
  sent_at             INTEGER NOT NULL,
  owner_mark          INTEGER NOT NULL DEFAULT 0
);
