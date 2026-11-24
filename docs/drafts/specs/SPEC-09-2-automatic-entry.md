# SPEC-09-2: the automatic flag on the log entry

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Carries `automatic` from `DraftSent` into the sent log entry (second of three; depends on SPEC-09-1).

Last change: 2026-11-24, rewritten after review of PR 202 (SPEC-09 split into 09-1 to 09-3; SPEC-07 takes the go from Intake's OwnerAnswered).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/log-entry.ts | Change | `NewLogEntry` and `blankLogEntry` carry `automatic` |
| src/drafts/domain/log-mapper.ts | Change | The sent entry takes `automatic` from `DraftSent` |
| test/drafts/auto-entry.test.ts | Create | The tests for FR-DRAFTS-04-11, entry part |

## Reuses
- Precedent: SPEC-04-drafts-log.md Task 1, which maps events to log entries in `log-mapper.ts`; this spec adds one field to that mapping.

## Tests first
- FR-DRAFTS-04-11 (1): given a `DraftSent` with `automatic: true`, the mapper's sent entry has `automatic: true`.
- FR-DRAFTS-04-11 (2): given `automatic: false`, the sent entry has `automatic: false`.
- FR-DRAFTS-04-11 (3): `blankLogEntry` has `automatic: false`.

## Build
```ts
export type NewLogEntry = { /* existing fields */ automatic: boolean };
```

## Done when
`bun test test/drafts/auto-entry.test.ts`

## Out of scope
The column, the trigger and the repository (SPEC-09-3).

## Open questions
None.
