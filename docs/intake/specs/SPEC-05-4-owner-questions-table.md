# SPEC-05-4: The table that holds the owner's questions

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

One new SQLite table `owner_questions` (TP-05 TD-2), created by a numbered migration and added to the list in `src/main/database.ts`. It holds the question number, the owner chat, the text, the time, the send id, the linked message and the closing time. No code reads it yet.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-5 | WHEN | When the session asks the owner a question with an owner number and a text, Intake sends the text from the business number to that number, records the question with a number and the time, and returns the number. |
| FR-INTAKE-05-11 | always | When the session reads the control chat, each message shows the question it answers, if any, and the session can list the open questions. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/adapters/sqlite/migrations/0008-owner-questions.sql` | Create | the table |
| `src/main/database.ts` | Change | appends the migration to the list |
| `test/intake/unit/owner-questions-migration.test.ts` | Create | the tests below |

## Reuses
- `src/main/database.ts` `openDatabase`: the list order is each file's `user_version`; append, never reorder
- `src/adapters/sqlite/migrate.ts` `migrate`: applies the list
- `src/intake/adapters/sqlite/migrations/0007-catchup-finished-at.sql` `ALTER`: the last migration of the slice, the pattern to follow

## Tests first
FR-INTAKE-05-5, FR-INTAKE-05-11, written before the code, without it in view, on a fresh database from `openDatabase`. FR-INTAKE-05-5: the table `owner_questions` exists with `number` (an integer primary key that counts up), `owner_chat`, `text`, `asked_at`, `send_id`, `linked_message`, `closed_at`; a row keeps the number and the time it was written with. FR-INTAKE-05-11: a query for open questions (`closed_at` empty) returns the rows not yet linked. A database made before the migration upgrades with its data kept.

## Build
```sql
CREATE TABLE owner_questions (
  number         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_chat     TEXT    NOT NULL,
  text           TEXT    NOT NULL,
  asked_at       INTEGER NOT NULL,
  send_id        TEXT    NOT NULL,
  linked_message TEXT,
  closed_at      INTEGER
);
CREATE INDEX owner_questions_open ON owner_questions (owner_chat) WHERE closed_at IS NULL;
```
`main/database.ts` imports the file as text like the others and appends it last.

## Done when
`bun test test/intake/unit/owner-questions-migration.test.ts`

## Out of scope
The repository that reads and writes the table (SPEC-05-5).

## Open questions
None.
