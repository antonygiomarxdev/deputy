# SPEC-08: the drafts counts per day

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Counts per local day three things from the drafts side, each from one source and never twice (R-DRAFTS-24): automatic answers (sent log entries with `automatic`), answers sent with an owner's go (used `pending_goes` rows), and hand approvals (approvals with basis `owner_words`; a missing basis counts as owner_words). An owner_go approval counts only as a go answer. The day is the local YYYY-MM-DD in the time zone passed in; the composition passes the owner's resolved time zone, the same as Intake SPEC-05-14. The joined view with Intake's counts is SPEC-15.

Last change: 2026-11-24, `localDayRange` added: nothing else turned `days` into a range (lead decision L16).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers, the answers sent with an owner's go, and the owner's hand approvals, and shall show the counts to the owner. (R-DRAFTS-24) |
| FR-DRAFTS-04-13 | WHEN | When the session asks for the pilot counts with a number of days, Deputy shall return the counts for that many local days ending today, from 1 to 30 days with 7 when no number is given, and shall refuse any other number. (R-DRAFTS-24. Owner decision L16.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/pilot-stats.ts | Create | `countsByDay`, the pure per-day counts over the three sources, and `localDayRange`, the pure range of the last `days` local days |
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
- FR-DRAFTS-04-13 (7): in `America/Chicago` (on 24 and 25 November standard time, six hours behind UTC), given now 2026-11-25T05:59:59.999Z (23:59:59.999 on the 24th), `localDayRange(1, now, zone)` starts at 2026-11-24T06:00:00Z; given now 2026-11-25T06:00:00Z (the midnight itself), it starts at that same instant, so the range is today only and `from` equals `to`.
- FR-DRAFTS-04-13 (8): in `America/Chicago`, given now 2026-11-25T12:00:00Z, `days` 7 starts at 2026-11-19T06:00:00Z and `days` 30 at 2026-10-27T05:00:00Z: the start of the local day `days - 1` calendar days ago; the 30 day start is on daylight time, five hours behind UTC, because the change back was on 1 November.
- FR-DRAFTS-04-13 (9): spring forward, `America/New_York`, given now 2026-03-09T14:00:00Z (10:00 on the 9th, after the change on the 8th), `days` 1 starts at 2026-03-09T04:00:00Z and `days` 2 starts at 2026-03-08T05:00:00Z, so the day of the change counts as one calendar day of 23 hours, not 24.
- FR-DRAFTS-04-13 (10): fall back, `America/New_York`, given now 2026-11-01T15:00:00Z (10:00 on the day of the change, a 25 hour day), `days` 1 starts at 2026-11-01T04:00:00Z and `days` 2 starts at 2026-10-31T04:00:00Z.
- FR-DRAFTS-04-13 (11): `to` is always `now`, and a `days` below 1, above 30 or not whole is refused by the caller (SPEC-16-3), so `localDayRange` is never called with it.

## Build
```ts
export type DailyCounts = { day: string; autoAnswers: number; goAnswers: number; ownerApprovals: number };
export function countsByDay(entries: { at: number; automatic: boolean; kind: "sent" | "approved" }[], usedGoes: { usedAt: number }[], approvals: { approvedAt: number; basis?: ApprovalBasis }[], timeZone: string): DailyCounts[];
// day = local YYYY-MM-DD of the instant in timeZone; ownerApprovals counts basis missing or owner_words
export function localDayRange(days: number, now: Instant, timeZone: string): { from: Instant; to: Instant };
// from = the first instant of the local day `days - 1` calendar days before the local day of `now` (calendar arithmetic on the local date, not 24 hour steps, so a daylight saving day is one day); to = now
```

## Done when
`bun test test/drafts/pilot-stats.test.ts`

## Out of scope
The joined view with Intake's counts and the `pilot_stats` handler (SPEC-15), the validation of `days` and the tool input (SPEC-16-3), Intake's counts (Intake PR 212), and the kill switch and hours (later, REQ-15).

## Open questions
None.
