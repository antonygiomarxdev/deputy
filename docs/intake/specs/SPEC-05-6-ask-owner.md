# SPEC-05-6: Ask the owner questions from the business number

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The use case `AskOwner`: given an owner number and one or more questions, each a text with the customer chat it is about, it refuses a number that is not an owner number, when the owner's 24 hour window with the business number is closed it sends nothing and records each question as not sent, and otherwise it sends ONE message that lists every question still open for that number, numbered, with `SendText`, records each new question and marks the earlier not-sent ones as sent. Lease required.

Last change: 2026-11-24, one numbered message for all open questions

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-5 | WHEN | When the session asks the owner one or more questions with an owner number, Intake shall send one message from the business number to that number that lists every question still open for it, numbered, shall record each new question with an id and the time, and shall return the ids. |
| FR-INTAKE-05-25 | always | Each question the session asks shall name the customer chat it is about, and Intake shall record that chat id with the question. |
| FR-INTAKE-05-26 | IF | If a question names a chat that is not a stored customer chat, either unknown or an owner's control chat, Intake shall send nothing, record nothing, and refuse with "unknown chat". |
| FR-INTAKE-05-6 | IF | If the owner's 24 hour window with the business number is closed, Intake shall send nothing, shall record each question as not sent, and shall return "window closed" with the question ids, so the session asks in the Claude app and tells the owner to answer on WhatsApp. The owner's later answer shall close the question as usual, and the next numbered message shall list a question that was not sent. |
| FR-INTAKE-05-7 | always | The owner's window with the business number shall be open for 24 hours after the latest message that owner number sent to the business number. |
| FR-INTAKE-05-8 | IF | If the number is not an owner number, Intake shall send nothing, record nothing, and refuse. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/ask-owner.ts` | Create | the `AskOwner` port and its result |
| `src/intake/application/ask-owner.ts` | Create | `AskOwnerUseCase` |
| `test/intake/unit/ask-owner.test.ts` | Create | the tests below |

## Reuses
- `src/intake/application/send-text.ts` `SendTextUseCase`: sends text to a chat; `AskOwner` calls it and does not rebuild it
- `src/intake/ports/send-text.ts` `SendTextResult`: the failure kinds `AskOwner` passes on
- `src/intake/domain/owner-numbers.ts` `OwnerNumbers`: decides whether a number is an owner number
- `src/intake/ports/message-repository.ts` `MessageRepository`: the latest message from the owner number gives the window
- Precedent: SPEC-05-1-control-chat-rule.md, `isControlChat`, which tells the owner's chat from a customer's
- Precedent: SPEC-05-5-owner-question-repository.md, the repository `AskOwner` records the questions with

## Tests first
FR-INTAKE-05-5, FR-INTAKE-05-25, FR-INTAKE-05-26, FR-INTAKE-05-6, FR-INTAKE-05-7, FR-INTAKE-05-8, written before the code, without it in view, with a fake provider, a fake clock and in-memory repositories. FR-INTAKE-05-5: with the window open and two questions, one message goes out from the business number to that number listing them numbered "1" and "2", each new question is recorded with its send id and the time, and the two ids come back in order; a second call with one more question sends one message listing all three, numbered, and records only the new one. FR-INTAKE-05-25: each question is recorded with the `chatId` it came with. FR-INTAKE-05-26: a question whose `chatId` has no stored message, or is the owner's own control chat, gets `unknown_chat`; nothing is sent and nothing is recorded, even when other questions in the call are fine. FR-INTAKE-05-6: with the window closed, nothing is sent, each question is recorded with no send id and the result is `not_sent` with `window_closed` and the question ids; a later call with the window open sends one message that lists the not-sent question too and gives it the send id. FR-INTAKE-05-7: the window is open at 23 hours 59 minutes after the owner's latest message to the business number, closed at 24 hours, and a new message from the owner reopens it. FR-INTAKE-05-8: a number that is not an owner number gets `not_an_owner_number` with nothing sent; a process without the lease gets `not_owner`; a failed send records no question.

## Build
```ts
export type AskOwnerResult =
  | { kind: "asked"; questionIds: string[] }
  | { kind: "not_sent"; reason: "window_closed"; questionIds: string[] }
  | { kind: "refused"; reason: "unknown_chat" | "not_an_owner_number" | "not_owner" }
  | { kind: "failed"; reason: Extract<SendTextResult, { kind: "failed" }>["reason"] };
export interface AskOwner { execute(q: { number: PhoneNumber; questions: { chatId: ChatId; text: string }[] }): Promise<AskOwnerResult> }
```
A chat is a customer chat when `messages.chatExists(chatId).exists` is true and `owners.isControlChat(chatId)` is false; every question is checked before anything is sent. The message has one line per open question: its position in the list, a colon and the text. The numbers in it are positions in this message; the ids are the table's. The owner window is the `sentAt` of the newest message sent by that number to the business number, plus 24 hours.

## Done when
`bun test test/intake/unit/ask-owner.test.ts`

## Out of scope
The tools (SPEC-05-8); recording an answer (SPEC-05-7); an empty list of questions, which the tool's input check refuses; a rate-limited or unknown send is passed on as `SendText` returns it.

## Open questions
None.
