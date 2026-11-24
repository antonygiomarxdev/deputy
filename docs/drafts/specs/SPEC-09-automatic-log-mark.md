# SPEC-09: the automatic mark on each log entry

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Writes the `automatic` mark on every sent log entry: a send the decision allowed without a go is marked automatic, a send the owner approved by hand is not (R-DRAFTS-22). The mark is a new column, so it needs a migration and the ADR-010 trigger update.

Last change: 2026-11-24, split after review of PR 202 (SPEC-09 added for the log mark; SPEC-08 keeps the counts only).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/migrations/0004-automatic.sql | Create | Adds `automatic INTEGER NOT NULL DEFAULT 0` to drafts_log and drops and recreates the ADR-010 `BEFORE UPDATE` trigger with `automatic` in its equality list |
| src/drafts/domain/log-mapper.ts | Change | Sets `automatic` on the sent entry from the send decision |
| test/drafts/auto-log.test.ts | Create | The tests for FR-DRAFTS-04-11 |

## Reuses
- Precedent: SPEC-04-drafts-log.md, which creates the log entries this spec marks; ADR-010-scrub-trigger-guard.md, whose trigger this migration rebuilds. The migration is appended to the list in `src/main/database.ts`; its position is its `user_version`.

## Tests first
- FR-DRAFTS-04-11 (1): given an automatic send, the sent log entry has `automatic` = 1.
- FR-DRAFTS-04-11 (2): given a send the owner approved by hand, `automatic` = 0.
- FR-DRAFTS-04-11 (3): given the ADR-010 scrub update (`scrubbed` 0 to 1), the trigger allows it and `automatic` is unchanged.

## Build
```ts
export function sentEntry(base: { draft: number; at: number }, automatic: boolean): { kind: "sent"; automatic: boolean } & typeof base;
```
The migration adds the column and rebuilds the ADR-010 trigger; the scrub rule itself is unchanged.

## Done when
`bun test test/drafts/auto-log.test.ts`

## Out of scope
The counts over the column (SPEC-08); the send decision (SPEC-05).

## Open questions
None.
