# SPEC-05-27: The owner's answers the dispatcher reads

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The read use case `OwnerAnswers`: it returns the messages the owner sent in the control chat since the oldest open question was asked, and the open questions with their ids and text. It reads no customer chat and returns no other message. A read; it needs no lease.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-35 | WHEN | When the dispatcher asks for the owner's answers, Intake shall return the messages the owner sent in the control chat since the oldest open question was asked, and the open questions with their ids and text, and nothing from any customer chat. With no open question it shall return none. (Proposed, lead decision, docs/adr/ADR-019.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/owner-answers.ts` | Create | the `OwnerAnswers` port and its result |
| `src/intake/application/owner-answers.ts` | Create | `OwnerAnswersUseCase` |
| `test/intake/unit/owner-answers.test.ts` | Create | the tests below |

## Reuses
- `src/intake/ports/message-repository.ts` `MessageRepository`: `listChat` reads the control chat
- `src/intake/domain/owner-numbers.ts` `OwnerNumbers`: tells the control chat of each owner number
- Precedent: SPEC-05-5-owner-question-repository.md, `listOpen` of the open questions

## Tests first
FR-INTAKE-05-35, written before the code, without it in view, with in-memory fakes and a fake clock. FR-INTAKE-05-35: with two open questions asked at 10:00 and 10:30 and owner messages at 09:00, 10:10 and 10:40, the result holds the two messages after 10:00 and both questions with their ids and text; with no open question it returns no messages and no questions; a message sent by the owner number in a customer chat, a customer message with a time inside the range, and a message Deputy sent through itself never appear; the result carries no chat id of a customer chat; with two owner numbers the answers of each control chat are returned with the chat they came from.

## Build
```ts
export type OwnerAnswersResult = {
  questions: { questionId: string; text: string; askedAt: Instant }[];
  messages: { ownerChat: ChatId; text: string; sentAt: Instant }[];
};
export interface OwnerAnswers { execute(): Promise<OwnerAnswersResult> }
```
The range starts at the `askedAt` of the oldest open question over all control chats. The text is labeled as the owner's words by the tool, not here.

## Done when
`bun test test/intake/unit/owner-answers.test.ts`

## Out of scope
The tool (SPEC-05-28); matching an answer to a question and recording it (the session, with `answer_question`, SPEC-05-7).

## Open questions
None.
