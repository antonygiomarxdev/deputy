# SPEC-09-6b-2: the drafts log repositories read and write the basis

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The SQLite log reads and writes `basis`; the test database lists migration 0007 so the contract sees the column (depends on SPEC-09-6b-1).

Last change: 2026-11-24, split so each run has at most three files, test files included.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner shall be able to check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval shall keep empty owner words and basis automatic; Deputy shall report it as automatic, not as an owner approval, and the log shall show each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/sqlite-draft-log-repository.ts | Change | `COLUMNS` includes `basis`; the row mapper reads it |
| test/drafts/contract/log-database.ts | Change | Lists migrations up to 0007, so the test database has the basis column |
| test/drafts/contract/draft-log-repository.contract.ts | Change | Adds the round-trip case below |

## Reuses
- Precedent: SPEC-09-3b-automatic-repository.md, which added the same kind of column to the same repository.

## Tests first
- FR-DRAFTS-04-5 (18): an approved entry appended with `basis: "owner_go"` reads back with that basis.

## Build
```ts
// sqlite-draft-log-repository.ts: COLUMNS adds "basis"; the row mapper reads it
```

## Done when
`bun test test/drafts/contract`

## Out of scope
The migration and trigger (SPEC-09-6b-1), the mapper (SPEC-09-6a-2), the in-memory log (SPEC-09-6d).

## Open questions
None.
