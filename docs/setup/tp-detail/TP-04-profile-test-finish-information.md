# TP-04-profile-test-finish: Information

Part of [TP-04-profile-test-finish.md](../tp/TP-04-profile-test-finish.md). Moved verbatim from there; nothing changed.

## Information

Tables owned by this TP (in addition to those of TP-01):

```sql
CREATE TABLE setup_profile_revision (
  run_id       INTEGER NOT NULL REFERENCES setup_run(id),
  revision     INTEGER NOT NULL,
  shown_at     TEXT,
  confirmed_at TEXT,
  owner_words  TEXT,
  seeded_at    TEXT,                      -- set when the seed ended ok or already_exists
  seed_result  TEXT CHECK (seed_result IN ('seeded','kept_existing')),   -- kept_existing for already_exists and seed_modified
  currency     TEXT,                      -- ISO 4217 code the owner confirmed
  PRIMARY KEY (run_id, revision)
);
CREATE TABLE setup_profile_answer (
  run_id   INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  question TEXT NOT NULL CHECK (question IN ('description','pickup_delivery','payment','tone_language')),
  answer   TEXT NOT NULL,
  PRIMARY KEY (run_id, revision, question),
  FOREIGN KEY (run_id, revision) REFERENCES setup_profile_revision(run_id, revision)
);
CREATE TABLE setup_catalog_item (
  run_id     INTEGER NOT NULL,
  revision   INTEGER NOT NULL,
  position   INTEGER NOT NULL,
  name       TEXT NOT NULL,
  price      TEXT,                          -- plain decimal with '.', or NULL
  unit       TEXT,
  available  INTEGER CHECK (available IN (0,1)),
  notes      TEXT,
  PRIMARY KEY (run_id, revision, position),
  FOREIGN KEY (run_id, revision) REFERENCES setup_profile_revision(run_id, revision)
);
CREATE TABLE setup_test (
  run_id                INTEGER PRIMARY KEY REFERENCES setup_run(id),
  started_at            TEXT NOT NULL,
  chat                  TEXT,              -- set when the message is found
  message_sent_stated_at TEXT,             -- the owner said they sent it (starts the delivery wait)
  injected              INTEGER NOT NULL DEFAULT 0 CHECK (injected IN (0,1))
);
```

Facts (`setup_fact`, TP-01) owned here: `reply_arrived` and `reply_not_arrived` (owner's words), `profile_reopened`, `currency_suggested`. A revision keeps its answers when a new one is made (copy then edit), so the history of what the owner confirmed stays.

A new revision copies the previous one's rows and edits them. The old rows stay. Answers hold only what the owner said about their business; the leak guard (TP-03) runs on every answer before it is stored.

Switching to the real provider (`SwitchToReal`): in one transaction, mark the test run `superseded_by` the new run; create the new run with mode `real`; copy the `install` progress row, the confirmed revision (rows, with `confirmed_at` and `seeded_at` kept) and the confirmed currency; nothing is seeded again unless the owner reopens step 5 and the files are still the seed's; steps 2, 3, 4 and 6 start at `todo`; add a `profile_reopened` prompt only when the owner asks. Test messages and chats stay in Intake's history (L3).
