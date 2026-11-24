# SPEC-09-3b: the repository reads and writes the automatic column

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The repository reads and writes `automatic`, and migration 0004 of SPEC-09-3a is registered in the list (depends on SPEC-09-3a).

Last change: 2026-11-24, after the lead's decision: the owner's go is recorded in pending_goes, not in approvals or the drafts log.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/sqlite-draft-log-repository.ts | Change | `COLUMNS` includes `automatic`; the row mapper reads it |
| src/main/database.ts | Change | Registers 0004-automatic.sql in the migration list |
| test/drafts/contract/draft-log-repository.contract.ts | Change | Adds the read and write cases below |

## Reuses
- Precedent: SPEC-04-drafts-log.md Task 2, which built the SQLite log and its registration; this spec adds the 0004 entry to the same list.

## Tests first
- FR-DRAFTS-04-11 (4): a sent entry appended with `automatic: true` reads back as `automatic: true`.
- FR-DRAFTS-04-11 (5): after open, `user_version` equals the position of 0004 in the migration list (the list length before 0004, plus one).
- FR-DRAFTS-04-11 (6): an entry appended without `automatic` reads back as `automatic: false`.

## Build
```ts
// sqlite-draft-log-repository.ts: COLUMNS adds "automatic"; the row mapper sets automatic = row.automatic === 1
// src/main/database.ts: the list gains 0004-automatic.sql at the end
```

## Done when
`bun test test/drafts/contract`

## Out of scope
The trigger and the column (SPEC-09-3a), the mapper (SPEC-09-2).

## Open questions
None.
