# Spec: automatic log entries and daily pilot counts (Drafts FRD-04)

Status: Draft

## Summary

Marks every automatic send as automatic with the knowledge it relied on, and keeps per-day counts of customer messages, automatic answers, owner questions and owner answers (R-DRAFTS-22, R-DRAFTS-24).

Last change: 2026-11-24, new spec for the local pilot (REQ-15, D31, D38).

## Context

Builds these rows of [FRD-04-drafts-log.md](../frd/FRD-04-drafts-log.md):

| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with the knowledge it relied on and its draft and time. (R-DRAFTS-22) |
| FR-DRAFTS-04-12 | always | Deputy shall count per day the customer messages, automatic answers, owner questions and owner answers, and shall show the counts to the owner. (R-DRAFTS-24) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/pilot-stats.ts | Create | The daily counts |
| test/drafts/pilot-stats.test.ts | Create | Tests for FR-DRAFTS-04-11 and FR-DRAFTS-04-12 |
| src/drafts/domain/log-entry.ts | Change | Adds the automatic mark and the knowledge reference |

## Interfaces

```ts
export type DailyCounts = { day: string; customerMessages: number; autoAnswers: number; ownerQuestions: number; ownerAnswers: number };
export function countsByDay(entries: { at: number; kind: string }[]): DailyCounts[];
```

## Data

None: this spec adds no stored data beyond the log entry it marks.

## Tasks

### Task 1: Automatic log entries and daily counts
- **Tests first:** `bun test test/drafts/pilot-stats.test.ts`, written before the code, one test per row above.
- **Done when:** `bun test test/drafts/pilot-stats.test.ts` passes.

## Out of scope
The kill switch and hours, which come later (REQ-15).
