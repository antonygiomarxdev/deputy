# SPEC-08: the pilot counts per day

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Counts per day three things, each from one source and never twice (R-DRAFTS-24): automatic answers (sent log entries with `automatic`), answers sent with an owner's go (used `pending_goes` rows, SPEC-10-2 `usedBetween`), and hand approvals (approvals with basis `owner_words`, SPEC-09-5b `approvalsBetween`). An owner_go approval is counted only as a go answer. The handler `pilotStatsTool` lives in the application layer. Customer-message and owner-question counts are Intake's and not here.

Last change: 2026-11-24, after the review of 7a56758: the go is one unit of work with its approval; closed window tells the owner; the always-ask list comes from Knowledge; reconcile on start; the basis is in the log read; pilotStatsTool is in the application layer.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers, the answers sent with an owner's go and the owner's hand approvals, and shall show the counts to the owner. (R-DRAFTS-24) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/pilot-stats.ts | Create | `countsByDay`: the pure per-day count |
| src/drafts/application/pilot-stats-tool.ts | Create | `pilotStatsTool`: reads the three sources and returns `countsByDay` |
| test/drafts/pilot-stats.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-10-2-pending-go-store.md, whose `usedBetween` read gives the go answers.
- Precedent: SPEC-09-5b-approvals-basis-repository.md, whose `approvalsBetween` read gives the hand approvals.

## Tests first
- FR-DRAFTS-04-12 (1): given automatic entries, used go rows and approvals on two days, `countsByDay` returns one row per day with `autoAnswers`, `goAnswers` and `ownerApprovals`.
- FR-DRAFTS-04-12 (2): given a day with no entries, no used go rows and no approvals, it returns no row for that day.
- FR-DRAFTS-04-12 (3): the returned type has no customer-message or owner-question field.
- FR-DRAFTS-04-12 (4): `pilotStatsTool` returns the `countsByDay` result for the same entries, go rows and approvals.
- FR-DRAFTS-04-12 (5): given an owner_go approval and its used go row for the same send, the day counts one go answer and no hand approval; an approval with no basis counts as a hand approval.

## Build
```ts
export type DailyCounts = { day: string; autoAnswers: number; goAnswers: number; ownerApprovals: number };
export function countsByDay(entries: { at: number; automatic: boolean; kind: "sent" | "approved" }[], usedGoes: { usedAt: number }[], approvals: { approvedAt: number; basis?: ApprovalBasis }[]): DailyCounts[];  // ownerApprovals: basis missing or owner_words
// application/pilot-stats-tool.ts
export function pilotStatsTool(d: { entries: () => Promise<Entry[]>; goes: () => Promise<{ usedAt: number }[]>; approvals: () => Promise<Approval[]> }): () => Promise<DailyCounts[]>;
```

## Done when
`bun test test/drafts/pilot-stats.test.ts`

## Out of scope
Customer-message and owner-question counts (Intake). The tool's registration is SPEC-13's. The kill switch and hours (later, REQ-15).

## Open questions
None.
