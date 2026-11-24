# SPEC-05-14: Intake counts customer messages and owner questions per day

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

A read port `IntakeDailyCounts` and its SQLite adapter: for each day in a range, the customer messages received and the owner questions asked, for Drafts' pilot stats. It returns counts only. Nothing calls it yet; the wiring spec exports it.

Last change: 2026-11-24, first draft

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-27 | WHEN | When Drafts or the session asks for the day's counts, Intake returns for each day the number of customer messages received and the number of owner questions asked, each counted once, and nothing else: no text, name or chat id. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/daily-counts.ts` | Create | the port and `IntakeDayCounts` |
| `src/intake/adapters/sqlite/sqlite-daily-counts.ts` | Create | the SQLite adapter |
| `test/intake/contract/daily-counts.contract.test.ts` | Create | the tests below |

## Reuses
- `src/shared/sql-database.ts` `SqlExecutor`: the port the adapter reads through
- Precedent: SPEC-05-5-owner-question-repository.md, the `owner_questions` table and its `asked_at` column this adapter counts
- Precedent: SPEC-05-4-owner-questions-table.md, the table the questions are counted from

## Tests first
FR-INTAKE-05-27, written before the code, without it in view, on an in-memory SQLite database with the migrations. FR-INTAKE-05-27: two customer messages and one owner question on day one and one customer message on day two give two rows with their counts; a day with neither has no row; a message from the owner's app, a message sent through Deputy and a stored dev message are not counted; a question asked with the owner window closed (not sent) is counted once on the day it was asked; the range includes its first instant and excludes its last; the rows are oldest first; no row holds text, a name or a chat id.

## Build
```ts
export type IntakeDayCounts = { day: string; customerMessages: number; ownerQuestions: number }; // day is the UTC date YYYY-MM-DD
export interface IntakeDailyCounts { between(from: Instant, to: Instant): Promise<IntakeDayCounts[]> }
```
Customer messages are the non-dev rows of `messages` with source `customer`, by `stored_at`. Owner questions are the rows of `owner_questions`, by `asked_at`. A read; it needs no lease.

## Done when
`bun test test/intake/contract/daily-counts.contract.test.ts`

## Out of scope
Showing the counts to the owner and merging them with Drafts' counts (Drafts SPEC-08 and SPEC-13); the owner's local day (the second open question of FRD-05).

## Open questions
None.
