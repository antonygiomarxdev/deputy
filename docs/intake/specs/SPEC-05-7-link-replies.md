# SPEC-05-7: Link the owner's reply to a question when it is stored

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

When `StoreMessages` stores a message in the control chat, it links it to the open question the message names, or else to the latest open question of that owner number, and closes it. A message with no open question to link is an instruction and links to nothing. Customer messages and Business-app echoes are never linked.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-9 | WHEN | When a message arrives in the control chat and names the number of an open question, Intake links the message to that question and closes it. |
| FR-INTAKE-05-10 | IF | If a message in the control chat names no question, Intake links it to the latest open question for that owner number; with none open, it is an instruction and links to nothing. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/application/store-messages.ts` | Change | the link step after a message is stored in the same transaction |
| `test/intake/unit/link-replies.test.ts` | Create | the tests below |

## Reuses
- `src/intake/application/store-messages.ts` `StoreMessages`: stores messages in one transaction and counts what it stored
- `src/intake/domain/owner-numbers.ts` `OwnerNumbers`: `isControlChat` (SPEC-05-1) says which stored messages count
- Precedent: SPEC-05-5-owner-question-repository.md, `latestOpen` and `link`

## Tests first
FR-INTAKE-05-9, FR-INTAKE-05-10, written before the code, without it in view, with the in-memory fakes of `test/support/intake-fixtures.ts`. FR-INTAKE-05-9: a control message that names the number of an open question links to that question, which closes; naming a closed or missing number links to the latest open one instead. FR-INTAKE-05-10: a control message that names none links to the latest open question of that owner number; with two open, the newer one; with none open it links to nothing and is stored as usual; a customer message or a Business-app echo never links. The link is written in the same transaction as the message, and storing the same message twice links once.

## Build
After `Message.receive` accepts a message in a control chat, inside the same `uow.run`: read the number the text names (see Open questions), else `questions.latestOpen(chat)`, then `questions.link(number, messageId, now)`. The unit of work's repositories gain `questions: OwnerQuestionRepository`.

## Done when
`bun test test/intake/unit/link-replies.test.ts`

## Out of scope
The repository (SPEC-05-5); showing the link to the session (SPEC-05-8).

## Open questions
- Q-1 (Lead): how a reply names a question (the FRD-05 open question). This spec reads "names" as the first whole number at the start of the message text, because the question text starts with its number; the lead confirms or changes that.
