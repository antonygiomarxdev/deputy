# SPEC-05-5: The repository of the owner's questions

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The outbound port `OwnerQuestionRepository` and its SQLite adapter over the table of SPEC-05-4: add a question and get its id, list the open ones for an owner chat, and record an answer (closing the question). It matches nothing by itself: the session names the question.

Last change: 2026-11-24, no latest-open fallback; the answer is recorded by id

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-9 | WHEN | When the session records an answer with the id of an open question and the owner's text, Intake closes that question and keeps the text with it. |
| FR-INTAKE-05-10 | IF | If the id is not an open question, Intake refuses and changes nothing. |
| FR-INTAKE-05-11 | always | When the session reads the control chat, it gets the owner's messages together with the open questions and their ids. Intake does not match a message to a question; the session does. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/owner-question-repository.ts` | Create | the port and `OwnerQuestion` |
| `src/intake/adapters/sqlite/sqlite-owner-question-repository.ts` | Create | the SQLite adapter |
| `test/intake/contract/owner-question-repository.contract.test.ts` | Create | the tests below |

## Reuses
- `src/intake/adapters/sqlite/sqlite-pending-changes-reader.ts` `SqlitePendingChangesReader`: the shape of a small SQLite repository over `SqlExecutor`
- `src/shared/sql-database.ts` `SqlExecutor`: the port the adapter writes through
- Precedent: SPEC-05-4-owner-questions-table.md, the table this adapter uses

## Tests first
FR-INTAKE-05-9, FR-INTAKE-05-10, FR-INTAKE-05-11, written before the code, without it in view, on an in-memory SQLite database with the migrations. FR-INTAKE-05-9: `answer(questionId, text, at)` stores the text, closes the question and returns true. FR-INTAKE-05-10: it returns false and changes nothing for an id that does not exist or is already closed. FR-INTAKE-05-11: `listOpen(ownerChat)` returns the open questions with their ids, oldest first; an answered one is gone from it; another owner chat's questions are not returned.

## Build
```ts
export interface OwnerQuestion { questionId: string; ownerChat: ChatId; text: string; askedAt: Instant; sendId: string; answer: string | null; closedAt: Instant | null }
export interface OwnerQuestionRepository {
  add(q: { ownerChat: ChatId; text: string; askedAt: Instant; sendId: string }): Promise<string>; // the question id
  listOpen(ownerChat: ChatId): Promise<OwnerQuestion[]>;
  answer(questionId: string, text: string, at: Instant): Promise<boolean>;
}
```
The question id is the decimal text of the row number.

## Done when
`bun test test/intake/contract/owner-question-repository.contract.test.ts`

## Out of scope
Adding the repository to `IntakeRepos` and to `test/support/intake-subjects.ts` (SPEC-05-6 and SPEC-05-7 do it where they first use it). An in-memory adapter: the pilot's tests use the SQLite adapter on an in-memory database.

## Open questions
None.
