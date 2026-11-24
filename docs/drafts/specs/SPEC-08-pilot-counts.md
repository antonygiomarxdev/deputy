# SPEC-08: the pilot counts per day

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Counts per day the automatic answers (the drafts log, `automatic`) and the answers sent with an owner's go (the `pending_goes` rows with `used_at` that day), and the owner's hand approvals, for the owner to read against Claude's usage status (R-DRAFTS-24). Customer-message and owner-question counts are Intake's and not here. Depends on SPEC-09-3b (the `automatic` column) and SPEC-10-2 (`pending_goes`).

Last change: 2026-11-24, go answers added to the count after the lead's decision.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers and the answers sent with an owner's go, and shall show the counts to the owner. (R-DRAFTS-24) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/pilot-stats.ts | Create | `countsByDay`: the per-day counts over automatic answers, go answers and hand approvals |
| src/drafts/adapters/sqlite/sqlite-pending-go-store.ts | Change | Adds `usedBetween`, the read of the used go rows (`usedAt`, `chatId`) that the counts need |
| test/drafts/pilot-stats.test.ts | Create | The tests for FR-DRAFTS-04-12 |

## Reuses
- Precedent: SPEC-10-2-pending-go-store.md, which holds the used go rows that this spec reads through `usedBetween`.
- Precedent: SPEC-04-drafts-log.md, which keeps the drafts log whose automatic entries this spec reads.

## Tests first
- FR-DRAFTS-04-12 (1): given automatic entries and used go rows on two days, `countsByDay` returns one row per day with that day's `autoAnswers`, `goAnswers` and `ownerApprovals`.
- FR-DRAFTS-04-12 (2): given a day with no entries and no used go rows, it returns no row for that day.
- FR-DRAFTS-04-12 (3): the returned type has no customer-message or owner-question field.

## Build
```ts
export type DailyCounts = { day: string; autoAnswers: number; goAnswers: number; ownerApprovals: number };
export function countsByDay(entries: { at: number; automatic: boolean; kind: "sent" | "approved" }[], usedGoes: { usedAt: number }[]): DailyCounts[];
// store: async usedBetween(fromMs: number, toMs: number): Promise<{ chatId: string; usedAt: number }[]>
```

## Done when
`bun test test/drafts/pilot-stats.test.ts`

## Out of scope
Customer-message and owner-question counts (Intake). The owner sees the counts through the `pilot_stats` tool; its registration is composition's (`src/composition`) and not part of this spec. The kill switch and hours (later, REQ-15).

## Open questions
None.
