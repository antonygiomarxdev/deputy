# SPEC-05-7: Link the owner's reply to a question when it is stored

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

When `StoreMessages` stores a message in the control chat, it links it to the open question the message names, or else to the latest open question of that owner number, closes it, and hands Drafts the question id and the text. A message with no open question to link is an instruction and links to nothing. Customer messages and Business-app echoes are never linked.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-9 | WHEN | When a message arrives in the control chat and names the id of an open question, Intake links the message to that question and closes it. |
| FR-INTAKE-05-10 | IF | If a message in the control chat names no question, Intake links it to the latest open question for that owner number; with none open, it is an instruction and links to nothing. |
| FR-INTAKE-05-22 | WHEN | When a control message is linked to a question, Intake hands Drafts the question id and the message text. Intake resolves the latest open question itself first, so Drafts never receives a reply that has no question id. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/application/store-messages.ts` | Change | the link step after a message is stored in the same transaction |
| `src/shared/signals.ts` | Change | the `OwnerAnswered` signal |
| `test/intake/unit/link-replies.test.ts` | Create | the tests below |

## Reuses
- `src/intake/application/store-messages.ts` `StoreMessages`: stores messages in one transaction and counts what it stored
- `src/intake/domain/owner-numbers.ts` `OwnerNumbers`: `isControlChat` (SPEC-05-1) says which stored messages count
- `src/shared/signals.ts` `OwnerReplyUnlinked`: the shape of a signal Intake publishes after the commit
- Precedent: SPEC-05-5-owner-question-repository.md, `latestOpen` and `link`

## Tests first
FR-INTAKE-05-9, FR-INTAKE-05-10, FR-INTAKE-05-22, written before the code, without it in view, with the in-memory fakes of `test/support/intake-fixtures.ts`. FR-INTAKE-05-9: a control message that names the number of an open question links to that question, which closes; naming a closed or missing number links to the latest open one instead. FR-INTAKE-05-22: each link publishes `OwnerAnswered` once with the question id and the text, after the commit; a message with no question publishes nothing; the fallback is resolved before the signal, so the id is never empty. FR-INTAKE-05-10: a control message that names none links to the latest open question of that owner number; with two open, the newer one; with none open it links to nothing and is stored as usual; a customer message or a Business-app echo never links. The link is written in the same transaction as the message, and storing the same message twice links once.

## Build
After `Message.receive` accepts a message in a control chat, inside the same `uow.run`: read the id the text names (see Open questions), else `questions.latestOpen(chat)`, then `questions.link(questionId, messageId, now)`. After the commit publish `{ name: "OwnerAnswered", questionId, text, at }`. The unit of work's repositories gain `questions: OwnerQuestionRepository`.

## Done when
`bun test test/intake/unit/link-replies.test.ts`

## Out of scope
The repository (SPEC-05-5); showing the link to the session (SPEC-05-8).

## Open questions
- Q-1 (Lead): how a reply names a question (the FRD-05 open question). This spec reads "names" as the first whole number at the start of the message text, because the question text starts with its id; the lead confirms or changes that.
