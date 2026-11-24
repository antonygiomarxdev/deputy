# TP-01-profile-and-catalog: Information

Part of [TP-01-profile-and-catalog.md](../tp/TP-01-profile-and-catalog.md). Moved verbatim from there; nothing changed.

## Information

SQLite, init migration of this slice (the lead places it in the numbered migration files). `proposals` is shared by TP-02 (lessons) and TP-03 (wipe); only `kind = 'change'` is used here.

```sql
CREATE TABLE proposals (
  number        INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL CHECK (kind IN ('change','lesson','wipe')),
  status        TEXT NOT NULL CHECK (status IN ('waiting','applying','applied','declined','superseded','expired')),
  target_key    TEXT NOT NULL,             -- 'profile:payment', 'catalog:Tamales (dozen)|price', 'mapping', 'lesson:<draft>', 'wipe'
  target        TEXT NOT NULL,             -- JSON, see below
  old_value     TEXT,
  new_value     TEXT,
  detail        TEXT NOT NULL DEFAULT '{}',-- JSON: row cells shown, questions, lesson fields (TP-02)
  code          INTEGER,                   -- wipe confirmation code (TP-03)
  draft_number  INTEGER,                   -- lesson source (TP-02)
  created_at    TEXT NOT NULL,
  decided_at    TEXT,
  expires_at    TEXT,                      -- wipe only
  superseded_by INTEGER REFERENCES proposals(number)
);
CREATE INDEX proposals_waiting ON proposals (kind, status, target_key);

CREATE TABLE knowledge_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN
    ('apply_requested','applied','apply_failed','declined','seed','setting','lesson_kept','lesson_edited','lesson_deleted')),
  proposal    INTEGER REFERENCES proposals(number),
  owner_words TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT ''     -- reason code, or old and new wording for lessons
);

CREATE TABLE catalog_seen (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  fingerprint TEXT NOT NULL,               -- SHA-256 of the table text (sheet) or of the file text
  saved_at    TEXT,                        -- null until a change is seen
  seen_at     TEXT NOT NULL
);
```

`target` JSON: `{"kind":"profile_section","section":"payment"}`, `{"kind":"catalog_set","item":"Tamales (dozen)","field":"availability"}`, `{"kind":"catalog_add"}`, `{"kind":"catalog_mapping"}`. `target_key` for a catalog set is `catalog:` plus the item name, a `|`, and the field, so a second proposal for the same item and field finds the first and supersedes it. `detail` for a catalog set holds `rowCells`.

Settings (the shared `settings` table, Knowledge keys, cross-cutting TD-8): `catalog_store` (`file` or `sheet:<spreadsheetId>`; the tab is always `Catalog`), `currency` (an ISO 4217 code), `catalog_mapping` (the `CatalogMapping` JSON). Changing `catalog_store` clears `catalog_mapping` in the same step, so the new source needs a new confirmation.

Owner files: `profile.md` (template below) and `catalog.csv` in the business folder. Catalog template (header only, the fields Deputy reads): `id,name,unit,price,available,notes`. Profile template: seven marked sections with a hint comment each; the `may_do` hint states that it guides drafts only and that nothing goes out without the owner's go (FR-KNOWLEDGE-01-2). The seed writes the catalog in this canonical shape (comma, `.` decimal, `yes` and `no`) and stores the matching mapping as confirmed, because Deputy wrote the file itself.
