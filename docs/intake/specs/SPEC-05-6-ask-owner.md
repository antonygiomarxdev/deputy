# SPEC-05-6: Ask the owner a question from the business number

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The use case `AskOwner`: given an owner number and a text, it refuses a number that is not an owner number, refuses with "window closed" when the owner's 24 hour window with the business number is closed, and otherwise sends the text with `SendText` and records the question. Lease required.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-5 | WHEN | When the session asks the owner a question with an owner number and a text, Intake sends the text from the business number to that number, records the question with an id and the time, and returns the id. |
| FR-INTAKE-05-6 | IF | If the owner's 24 hour window with the business number is closed, Intake sends nothing, records nothing and returns "window closed", so the session asks in the Claude app and tells the owner to answer on WhatsApp. |
| FR-INTAKE-05-7 | always | The owner's window with the business number is open for 24 hours after the latest message that owner number sent to the business number. |
| FR-INTAKE-05-8 | IF | If the number is not an owner number, Intake sends nothing, records nothing and refuses. |

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
- Precedent: SPEC-05-5-owner-question-repository.md, the repository `AskOwner` records the question with

## Tests first
FR-INTAKE-05-5, FR-INTAKE-05-6, FR-INTAKE-05-7, FR-INTAKE-05-8, written before the code, without it in view, with a fake provider, a fake clock and in-memory repositories. FR-INTAKE-05-5: with the window open, the text goes out from the business number to that number once, a question is recorded with the send id and the time, and its id is returned. FR-INTAKE-05-6: with the window closed, nothing is sent, nothing is recorded and the result is `window_closed`. FR-INTAKE-05-7: the window is open at 23 hours 59 minutes after the owner's latest message to the business number, closed at 24 hours, and a new message from the owner reopens it. FR-INTAKE-05-8: a number that is not an owner number gets `not_an_owner_number` with nothing sent; a process without the lease gets `not_owner`; a failed send records no question.

## Build
```ts
export type AskOwnerResult =
  | { kind: "asked"; questionId: string }
  | { kind: "refused"; reason: "window_closed" | "not_an_owner_number" | "not_owner" }
  | { kind: "failed"; reason: Extract<SendTextResult, { kind: "failed" }>["reason"] };
export interface AskOwner { execute(q: { number: PhoneNumber; text: string }): Promise<AskOwnerResult> }
```
The owner window is the `sentAt` of the newest message sent by that number to the business number, plus 24 hours.

## Done when
`bun test test/intake/unit/ask-owner.test.ts`

## Out of scope
The tool (SPEC-05-8); linking the reply (SPEC-05-7); a rate-limited or unknown send is passed on as `SendText` returns it.

## Open questions
None.
