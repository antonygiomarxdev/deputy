CREATE TABLE lease (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  token          TEXT    NOT NULL,
  holder_started INTEGER NOT NULL,
  heartbeat      INTEGER NOT NULL
);

CREATE TABLE settings (          -- one owner slice per key (cross-cutting TD-3, "Keys by owner")
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  changed_at INTEGER NOT NULL
);

CREATE TABLE pending_changes (   -- written by the command line without the lease; read by ApplyPendingChanges
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  command    TEXT    NOT NULL,   -- the command the owner typed
  at         INTEGER NOT NULL,
  applied_at INTEGER
);
