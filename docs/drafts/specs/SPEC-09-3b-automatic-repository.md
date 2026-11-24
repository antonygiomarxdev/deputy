# SPEC-09-3b: the repository reads and writes the automatic column

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The repository reads and writes `automatic` (depends on SPEC-09-3a). Registration and the version check are SPEC-09-3c.

Last change: 2026-11-24, after the lead's review: split of the migration specs, the tools spec added.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/sqlite-draft-log-repository.ts | Change | `COLUMNS` includes `automatic`; the row mapper reads it |
| test/drafts/contract/draft-log-repository.contract.ts | Change | Adds the read and write cases below to the repository contract |

## Reuses
- Precedent: SPEC-04-drafts-log.md Task 2, which built the SQLite log's repository and its contract.

## Tests first
- FR-DRAFTS-04-11 (4): a sent entry appended with `automatic: true` reads back as `automatic: true`.
- FR-DRAFTS-04-11 (6): an entry appended without `automatic` reads back as `automatic: false`.

## Build
```ts
// sqlite-draft-log-repository.ts: COLUMNS adds "automatic"; the row mapper sets automatic = row.automatic === 1
```

## Done when
`bun test test/drafts/contract`

## Out of scope
The trigger (SPEC-09-3a), the registration and version check (SPEC-09-3c), and the mapper (SPEC-09-2).

## Open questions
None.
