# SPEC-08: the drafts counts per day

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Counts per local day three things from the drafts side, each from one source and never twice (R-DRAFTS-24): automatic answers (sent log entries with `automatic`), answers sent with an owner's go (used `pending_goes` rows), and hand approvals (approvals with basis `owner_words`; a missing basis counts as owner_words). An owner_go approval counts only as a go answer. The day is the local YYYY-MM-DD in the time zone passed in; the composition passes the owner's resolved time zone, the same as Intake SPEC-05-14. The joined view with Intake's counts is SPEC-15.

Last change: 2026-11-24, the day and the time zone are explicit; the handler moved to SPEC-15.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers, the answers sent with an owner's go and the owner's hand approvals, and shall show the counts to the owner. (R-DRAFTS-24) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/pilot-stats.ts | Create | `countsByDay`: the pure per-day counts over the three sources |
| test/drafts/pilot-stats.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-10-2-pending-go-store.md, whose `usedBetween` read supplies the used go rows.
- Precedent: SPEC-09-5b-approvals-port.md, whose `approvalsBetween` read supplies the approvals.

## Tests first
- FR-DRAFTS-04-12 (1): given automatic entries, used go rows and approvals on two days, `countsByDay` returns one row per day with `autoAnswers`, `goAnswers` and `ownerApprovals`.
- FR-DRAFTS-04-12 (2): given a day with no entries, no used go rows and no approvals, it returns no row for that day.
- FR-DRAFTS-04-12 (3): the returned type has no customer-message or owner-question field.
- FR-DRAFTS-04-12 (5): given an owner_go approval and its used go row for the same send, the day counts one go answer and no hand approval; an approval with no basis counts as a hand approval.
- FR-DRAFTS-04-12 (6): given an event at 23:30 and one at 00:10 the next day, in the time zone passed in, they fall on different days.

## Build
```ts
export type DailyCounts = { day: string; autoAnswers: number; goAnswers: number; ownerApprovals: number };
export function countsByDay(entries: { at: number; automatic: boolean; kind: "sent" | "approved" }[], usedGoes: { usedAt: number }[], approvals: { approvedAt: number; basis?: ApprovalBasis }[], timeZone: string): DailyCounts[];
// day = local YYYY-MM-DD of the instant in timeZone; ownerApprovals counts basis missing or owner_words
```

## Done when
`bun test test/drafts/pilot-stats.test.ts`

## Out of scope
The joined view with Intake's counts and the `pilot_stats` handler (SPEC-15), Intake's counts (Intake PR 212), and the kill switch and hours (later, REQ-15).

## Open questions
None.
