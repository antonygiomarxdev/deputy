# SPEC-10-1: the pending_goes table and its registration

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Adds the `pending_goes` table that keeps the owner's go across a restart (FR-DRAFTS-02-15) and is the audit of each go (`used_at`, `send_id`), and registers it. The store is SPEC-10-2.

Last change: 2026-11-24, after the lead's decision: the owner's go is recorded in pending_goes, not in approvals or the drafts log.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-15 | WHEN | When Deputy restarts, a go shall stay until one send uses it or a newer go for the same chat replaces it. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/migrations/0005-pending-goes.sql | Create | Table `pending_goes` (id INTEGER PRIMARY KEY, question_id TEXT NOT NULL, chat_id TEXT NOT NULL, text TEXT NOT NULL, answered_at INTEGER NOT NULL, used_at INTEGER, send_id TEXT) and an index on (chat_id, used_at) |
| src/main/database.ts | Change | Registers 0005-pending-goes.sql at the end of the migration list |
| test/drafts/contract/pending-goes-migration.test.ts | Create | The tests below for the migration |

## Reuses
- Precedent: SPEC-09-3b-automatic-repository.md, which registers migration 0004 in the same list; this spec does the same for 0005.

## Tests first
- FR-DRAFTS-02-15 (1): after the migration, `pending_goes` exists with the listed columns, including `used_at` and `send_id`.
- FR-DRAFTS-02-15 (2): the index on (chat_id, used_at) exists.
- FR-DRAFTS-02-15 (3): after open, `user_version` equals the position of 0005 in the list (the list length before 0005, plus one).

## Build
```sql
CREATE TABLE pending_goes (id INTEGER PRIMARY KEY, question_id TEXT NOT NULL, chat_id TEXT NOT NULL, text TEXT NOT NULL, answered_at INTEGER NOT NULL, used_at INTEGER, send_id TEXT);
CREATE INDEX pending_goes_chat ON pending_goes (chat_id, used_at);
```

## Done when
`bun test test/drafts/contract/pending-goes-migration.test.ts`

## Out of scope
The store (SPEC-10-2).

## Open questions
None.
