# SPEC-05-7: Record the owner's answer to a question

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The use case `AnswerQuestion`: the session names an open question by its id and gives the owner's text; Intake closes the question, keeps the text with it and publishes `OwnerAnswered` with the id and the text so Drafts can take it as the go for that answer. Intake matches nothing: the session decides which answer belongs to which question. Lease required.

Last change: 2026-11-24, first draft after the owner's ruling that the session records answers

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-9 | WHEN | When the session records an answer with the id of an open question and the owner's text, Intake closes that question and keeps the text with it. |
| FR-INTAKE-05-10 | IF | If the id is not an open question, Intake refuses and changes nothing. |
| FR-INTAKE-05-22 | WHEN | When Intake closes a question with an answer, it hands Drafts the question id and the text. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/answer-question.ts` | Create | the `AnswerQuestion` port and its result |
| `src/intake/application/answer-question.ts` | Create | `AnswerQuestionUseCase` |
| `test/intake/unit/answer-question.test.ts` | Create | the tests below |

## Reuses
- `src/intake/ports/event-publisher.ts` `EventPublisher`: the port Intake publishes its events through
- `src/intake/ports/intake-unit-of-work.ts` `IntakeUnitOfWork`: one transaction that checks the lease first; the repository joins it
- Precedent: SPEC-05-5-owner-question-repository.md, `answer` and `listOpen`
- Precedent: SPEC-05-12-owner-answered-signal.md, the signal this use case publishes

## Tests first
FR-INTAKE-05-9, FR-INTAKE-05-10, FR-INTAKE-05-22, written before the code, without it in view, with the in-memory fakes of `test/support/intake-fixtures.ts` and a recording publisher. FR-INTAKE-05-9: an open question is closed with the given text and the result is `recorded`. FR-INTAKE-05-10: an id that does not exist, or a question already closed, is refused with `unknown_question` and nothing changes and nothing is published; a process without the lease is refused with `not_owner` and writes nothing. FR-INTAKE-05-22: one `OwnerAnswered` with that question id and that text is published after the commit, once; a refused call publishes nothing; the signal carries the id as text.

## Build
```ts
export type AnswerQuestionResult = { kind: "recorded" } | { kind: "refused"; reason: "unknown_question" | "not_owner" };
export interface AnswerQuestion { execute(q: { questionId: string; text: string }): Promise<AnswerQuestionResult> }
```
Inside one `uow.run`: `questions.answer(questionId, text, now)`; when it returns false the result is `unknown_question`. After the commit, `publish({ name: "OwnerAnswered", questionId, text, at })`. The unit of work's repositories gain `questions: OwnerQuestionRepository`.

## Done when
`bun test test/intake/unit/answer-question.test.ts`

## Out of scope
The tool (SPEC-05-8); the signal type (SPEC-05-12); what Drafts does with the answer. Checking that the text is the owner's is Proposed and not decided: the second open question of FRD-05.

## Open questions
None.
