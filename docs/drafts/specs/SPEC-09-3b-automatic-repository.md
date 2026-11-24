# SPEC-09-3b: the repository reads and writes the automatic column

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The repository reads and writes `automatic`, and the migration of SPEC-09-3a is registered in the list (depends on SPEC-09-3a).

Last change: 2026-11-24, split and extended after the review of PR 202 (pending go async; optional automatic; wiring and send-path specs added).

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
- Precedent: SPEC-04-drafts-log.md Task 2, which built the SQLite log and its registration; this spec adds the 0004 entry to the same list. The migration's position is its `user_version`.

## Tests first
- FR-DRAFTS-04-11 (4): a sent entry appended with `automatic: true` reads back as `automatic: true`.
- FR-DRAFTS-04-11 (5): the database registers 0004, so `user_version` is 4 after open.
- FR-DRAFTS-04-11 (6): an entry appended without `automatic` reads back as `automatic: false`.

## Build
```ts
// in sqlite-draft-log-repository.ts: COLUMNS adds "automatic"; the row mapper sets automatic = row.automatic === 1
```

## Done when
`bun test test/drafts/contract`

## Out of scope
The trigger and the column (SPEC-09-3a), the mapper (SPEC-09-2).

## Open questions
None.
