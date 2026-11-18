CREATE TABLE owner_numbers (
  number    TEXT PRIMARY KEY,
  kind      TEXT NOT NULL CHECK (kind IN ('business','extra')),
  label     TEXT NOT NULL DEFAULT '',
  added_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX owner_numbers_one_business ON owner_numbers (kind) WHERE kind = 'business';

CREATE TABLE owner_number_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       INTEGER NOT NULL,
  action   TEXT    NOT NULL CHECK (action IN ('add','remove')),
  number   TEXT    NOT NULL,
  kind     TEXT    NOT NULL CHECK (kind IN ('business','extra')),
  label    TEXT    NOT NULL DEFAULT '',
  command  TEXT    NOT NULL
);
CREATE TRIGGER owner_number_log_no_update BEFORE UPDATE ON owner_number_log
  BEGIN SELECT RAISE(ABORT, 'owner_number_log is append-only'); END;
CREATE TRIGGER owner_number_log_no_delete BEFORE DELETE ON owner_number_log
  BEGIN SELECT RAISE(ABORT, 'owner_number_log is append-only'); END;
