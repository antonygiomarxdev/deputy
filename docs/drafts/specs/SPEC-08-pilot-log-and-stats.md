# SPEC-08: the automatic mark in the log and the pilot counts

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Marks each automatic send as automatic in drafts_log and counts per day the automatic answers and the owner's approvals (R-DRAFTS-22, R-DRAFTS-24). Customer-message and owner-question counts are Intake's and not here.

Last change: 2026-11-24, rewritten in the format 4 layout after review of PR 202.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |
| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers and the owner's approvals in the drafts log, and shall show the counts to the owner. (R-DRAFTS-24) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/migrations/0004-automatic.sql | Create | Adds the automatic column to drafts_log and rebuilds the ADR-010 update trigger so the column is compared like the others |
| src/drafts/domain/pilot-stats.ts | Create | The per-day counts over automatic answers and owner approvals |
| test/drafts/pilot-stats.test.ts | Create | The tests for FR-DRAFTS-04-11 and FR-DRAFTS-04-12 |

## Reuses
- Precedent: SPEC-04-drafts-log.md, which appends the log entries this spec marks.
- ADR-010-scrub-trigger-guard.md: the trigger this migration rebuilds. The migration is appended to the list in `src/main/database.ts`; its position is its `user_version`.

## Tests first
- FR-DRAFTS-04-11 (1): given an automatic send, the log entry has `automatic` = 1.
- FR-DRAFTS-04-11 (2): given a send the owner approved by hand, `automatic` = 0.
- FR-DRAFTS-04-12 (3): given entries on two days, `countsByDay` returns one row per day with that day's automatic answers and owner approvals, and no customer-message or owner-question field.

## Build
```ts
export type DailyCounts = { day: string; autoAnswers: number; ownerApprovals: number };
export function countsByDay(entries: { at: number; automatic: boolean; kind: "sent" | "approved" }[]): DailyCounts[];
```
The migration adds `automatic INTEGER NOT NULL DEFAULT 0` and drops and recreates the `BEFORE UPDATE` trigger of ADR-010 with `automatic` in its equality list. The ADR-010 scrub rule is unchanged.

## Done when
`bun test test/drafts/pilot-stats.test.ts`

## Out of scope
Customer-message and owner-question counts (Intake); the kill switch and hours (later, REQ-15).

## Open questions
None.
