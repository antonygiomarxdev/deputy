# SPEC-08: the pilot counts per day

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Counts per day the automatic answers and the owner's approvals from the drafts log (R-DRAFTS-24). Customer-message and owner-question counts are Intake's and not here. Depends on SPEC-09-3b for the `automatic` column.

Last change: 2026-11-24, rewritten after review of PR 202 (SPEC-09 split into 09-1 to 09-3; SPEC-07 takes the go from Intake's OwnerAnswered).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers and the owner's approvals in the drafts log, and shall show the counts to the owner. (R-DRAFTS-24) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/pilot-stats.ts | Create | The per-day counts over automatic answers and owner approvals |
| test/drafts/pilot-stats.test.ts | Create | The tests for FR-DRAFTS-04-12 |

## Reuses
- Precedent: SPEC-04-drafts-log.md, which keeps the log that this spec reads.

## Tests first
- FR-DRAFTS-04-12 (1): given entries on two days, `countsByDay` returns one row per day with that day's automatic answers and owner approvals.
- FR-DRAFTS-04-12 (2): given a day with no entries, it returns no row for that day.
- FR-DRAFTS-04-12 (3): the returned type has no customer-message or owner-question field.

## Build
```ts
export type DailyCounts = { day: string; autoAnswers: number; ownerApprovals: number };
export function countsByDay(entries: { at: number; automatic: boolean; kind: "sent" | "approved" }[]): DailyCounts[];
```

## Done when
`bun test test/drafts/pilot-stats.test.ts`

## Out of scope
Customer-message and owner-question counts (Intake). The owner sees the counts through the `pilot_stats` tool; its registration is composition's (`src/composition`) and not part of this spec. The kill switch and hours (later, REQ-15).

## Open questions
None.
