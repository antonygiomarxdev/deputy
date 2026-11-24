# SPEC-09-3c: the migration list registers 0004

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Registers 0004-automatic.sql in the migration list of the database and checks the schema version against its position in that list (depends on SPEC-09-3b).

Last change: 2026-11-24, after the lead's review: split of the migration specs, the tools spec added.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/main/database.ts | Change | Registers 0004-automatic.sql at the end of the migration list |
| test/drafts/contract/database-registration.sqlite.test.ts | Create | The version check below, against a database opened with the real list |

## Reuses
- Precedent: SPEC-04-drafts-log.md Task 2, which added 0002 to the same list; this spec adds 0004 at its end.

## Tests first
- FR-DRAFTS-04-11 (5): after open, `user_version` equals the position of 0004 in the migration list (the list length before 0004, plus one).

## Build
```ts
// src/main/database.ts: the migration list gains 0004-automatic.sql at the end
```

## Done when
`bun test test/drafts/contract/database-registration.sqlite.test.ts`

## Out of scope
The column and trigger (SPEC-09-3a), the repository (SPEC-09-3b).

## Open questions
None.
