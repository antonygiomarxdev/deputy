# SPEC-05-16: The owner-question repository lists the answered questions

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

Add `listAnswered` to the owner-question repository and its SQLite adapter: every question that has an answer, oldest answer first. It is the read that Drafts' reconcile on start needs.

Last change: 2026-11-24, first draft

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-28 | WHEN | When Drafts asks for the answered questions at start, Intake returns each question that has an answer with the question id, the customer chat it names, the answer text and the time of the answer, so that an answer given while Drafts was not running is not lost. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/owner-question-repository.ts` | Create (SPEC-05-5 creates it; this spec adds one method) | `listAnswered` |
| `src/intake/adapters/sqlite/sqlite-owner-question-repository.ts` | Create (SPEC-05-5 creates it; this spec adds the query) | the SQL |
| `test/intake/contract/owner-question-repository.contract.test.ts` | Create (SPEC-05-5 creates it; this spec adds the cases) | the cases below |

## Reuses
- Precedent: SPEC-05-5-owner-question-repository.md, the repository this spec extends.
- Precedent: SPEC-05-4-owner-questions-table.md, the table that keeps the answer text and the closing time.

## Tests first
FR-INTAKE-05-28, written before the code, on an in-memory SQLite database with the migrations: with one open question and two answered ones, `listAnswered` returns only the two answered ones, oldest answer first, each with its question id, customer chat, answer text and closing time; with no answered question it returns an empty list.

## Build
```ts
listAnswered(): Promise<OwnerQuestion[]>; // answer is not null, ordered by closedAt then question id
```
It reads only; it needs no lease.

## Done when
`bun test test/intake/contract/owner-question-repository.contract.test.ts`

## Out of scope
- The use case and the export for Drafts: SPEC-05-17.

## Open questions
None.
