# SPEC-09-3: the automatic column in drafts_log

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Stores `automatic` in drafts_log: a migration adds the column and rebuilds the ADR-010 update trigger, the repository reads and writes it, and the migration is registered (third of three; depends on SPEC-09-2). A new column needs the trigger update, because the trigger compares every column.

Last change: 2026-11-24, rewritten after review of PR 202 (SPEC-09 split into 09-1 to 09-3; SPEC-07 takes the go from Intake's OwnerAnswered).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/migrations/0004-automatic.sql | Create | Adds `automatic INTEGER NOT NULL DEFAULT 0` and rebuilds the ADR-010 `BEFORE UPDATE` trigger with `automatic` in its equality list |
| src/drafts/adapters/sqlite/sqlite-draft-log-repository.ts | Change | `COLUMNS` includes `automatic`; the row mapper reads it |
| src/main/database.ts | Change | Registers 0004-automatic.sql in the migration list |

## Reuses
- `docs/drafts/adr/ADR-010-scrub-trigger-guard.md` `trigger`: the decision whose trigger this migration rebuilds. The new migration's position in the list is its `user_version`.
- The repository contract tests (`test/drafts/contract/draft-log-repository.contract.ts`) gain the three cases below; they are the repository's existing suite, so they do not add a Files row.

## Tests first
- FR-DRAFTS-04-11 (1): after migration 0004, `drafts_log` has `automatic` with default 0.
- FR-DRAFTS-04-11 (2): the ADR-010 scrub update (`scrubbed` 0 to 1) is allowed and leaves `automatic` unchanged.
- FR-DRAFTS-04-11 (3): an update that changes `automatic` is refused by the trigger.

## Build
```sql
ALTER TABLE drafts_log ADD COLUMN automatic INTEGER NOT NULL DEFAULT 0;
-- drop and recreate the BEFORE UPDATE trigger of ADR-010 with automatic in its equality list
```
The scrub rule itself is unchanged.

## Done when
`bun test test/drafts/contract`

## Out of scope
The event and mapper (SPEC-09-1, 09-2) and the counts (SPEC-08).

## Open questions
None.
