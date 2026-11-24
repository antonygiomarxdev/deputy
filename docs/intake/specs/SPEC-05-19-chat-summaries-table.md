# SPEC-05-19: The table that holds a summary per chat

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

One new SQLite table `chat_summaries` (one row per customer chat) created by a numbered migration and added to the list in `src/main/database.ts` after the Intake migration of SPEC-05-4. No code reads it yet.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-32 | WHEN | When a helper saves a chat summary with the chat id and its token, Intake replaces the stored summary of that chat with it. A token that does not match the chat id is refused and nothing is stored. (Proposed, lead decision, ADR-019.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/adapters/sqlite/migrations/0009-chat-summaries.sql` | Create | the table |
| `src/main/database.ts` | Change | appends the migration |
| `test/intake/unit/chat-summaries-migration.test.ts` | Create | the tests below |

## Reuses
- `src/main/database.ts` `openDatabase`: the list order is each file's user_version; append, never reorder
- Precedent: SPEC-05-4-owner-questions-table.md, the migration this one follows

## Tests first
FR-INTAKE-05-32, written before the code, without it in view, on a fresh database from `openDatabase`. FR-INTAKE-05-32: the table `chat_summaries` exists with `chat_id` (the primary key), `text` and `updated_at`; writing a second row for the same chat id replaces the first through an upsert; a database made before the migration upgrades with its data kept.

## Build
```sql
CREATE TABLE chat_summaries (
  chat_id    TEXT    PRIMARY KEY,
  text       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);
```
`main/database.ts` imports the file as text and appends it after the Intake migrations that exist when this spec is built and before the Drafts pilot migrations.

## Done when
`bun test test/intake/unit/chat-summaries-migration.test.ts`

## Out of scope
The repository (SPEC-05-20).

## Open questions
None.
