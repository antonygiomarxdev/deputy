# SPEC-05-17: Intake exports the answered questions for Drafts

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

A use case `ListAnsweredQuestions` over the repository's `listAnswered`, exported from `src/intake/index.ts` as `listAnsweredQuestions`, so Drafts can record answers it missed while it was not running (Drafts SPEC-11).

Last change: 2026-11-24, first draft

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-28 | WHEN | When Drafts asks for the answered questions at start, Intake shall return each question that has an answer with the question id, the customer chat it names, the answer text and the time of the answer, so that an answer given while Drafts was not running is not lost. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/application/list-answered-questions.ts` | Create | `ListAnsweredQuestionsUseCase` |
| `src/intake/index.ts` | Change | export the use case and the `OwnerAnswer` type |
| `test/intake/unit/list-answered-questions.test.ts` | Create | the tests below |

## Reuses
- `src/intake/index.ts` `EventPublisher`: an exported type, the pattern for what this file adds.
- Precedent: SPEC-05-16-list-answered-in-repository.md, the read this use case calls.

## Tests first
FR-INTAKE-05-28, written before the code, with the in-memory repository: two answered questions come back as `OwnerAnswer` values with the question id, the customer chat, the answer text and the closing time as `at`; an open question is not in the list; the list is the same when called twice.

## Build
```ts
export type OwnerAnswer = { questionId: string; chatId: ChatId; text: string; at: Instant };
export interface ListAnsweredQuestions { execute(): Promise<OwnerAnswer[]> }
```
`src/intake/index.ts` exports both, and `listAnsweredQuestions` for Drafts is `useCase.execute` bound.

## Done when
`bun test test/intake/unit/list-answered-questions.test.ts`

## Out of scope
- The repository read: SPEC-05-16. Drafts' reconcile that calls it: Drafts SPEC-11. Building the use case in the composition: SPEC-05-15.

## Open questions
None.
