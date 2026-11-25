# SPEC-05-4: The table that holds the owner's questions

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

One new SQLite table `owner_questions` (TP-05 TD-2), created by a numbered migration and added to the list in `src/main/database.ts`. It holds the question number (whose decimal text is the question id), the owner chat, the customer chat the question is about, the text, the time, the send id, the answer text and the closing time. No code reads it yet.

Last change: 2026-11-24, the table keeps the answer text, not a linked message

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-5 | WHEN | When the session asks the owner one or more questions with an owner number, Intake shall send one message from the business number to that number that lists every question still open for it, numbered, shall record each new question with an id and the time, and shall return the ids. |
| FR-INTAKE-05-25 | always | Each question the session asks shall name the customer chat it is about, and Intake shall record that chat id with the question. |
| FR-INTAKE-05-6 | IF | If the owner's 24 hour window with the business number is closed, Intake shall send nothing, shall record each question as not sent, and shall return "window closed" with the question ids, so the session asks in the Claude app and tells the owner to answer on WhatsApp. The owner's later answer shall close the question as usual, and the next numbered message shall list a question that was not sent. |
| FR-INTAKE-05-9 | WHEN | When the session records an answer with the id of an open question and the owner's text, Intake shall close that question and keep the text with it. |

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
FR-INTAKE-05-5, FR-INTAKE-05-25, FR-INTAKE-05-6, FR-INTAKE-05-9, written before the code, without it in view, on a fresh database from `openDatabase`. FR-INTAKE-05-5: the table `owner_questions` exists with `number` (an integer primary key that counts up), `owner_chat`, `chat_id`, `text`, `asked_at`, `send_id`, `answer`, `closed_at`; a row keeps the number and the time it was written with. FR-INTAKE-05-9: a row can take an answer text and a closing time, and a query for open questions (`closed_at` empty) returns the rows not yet answered. FR-INTAKE-05-25: a row keeps the customer chat id it was written with and refuses a missing one. FR-INTAKE-05-6: a row can be written with no `send_id`, which means the question was not sent. A database made before the migration upgrades with its data kept.

## Build
```sql
CREATE TABLE owner_questions (
  number     INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_chat TEXT    NOT NULL,
  chat_id    TEXT    NOT NULL,
  text       TEXT    NOT NULL,
  asked_at   INTEGER NOT NULL,
  send_id    TEXT,
  answer     TEXT,
  closed_at  INTEGER
);
CREATE INDEX owner_questions_open ON owner_questions (owner_chat) WHERE closed_at IS NULL;
```
`main/database.ts` imports the file as text like the others and appends it after `0007-catchup-finished-at` and before the Drafts pilot migrations (the list order is each file's user_version and nothing has shipped).

## Done when
`bun test test/intake/unit/owner-questions-migration.test.ts`

## Out of scope
The repository that reads and writes the table (SPEC-05-5).

## Open questions
None.
