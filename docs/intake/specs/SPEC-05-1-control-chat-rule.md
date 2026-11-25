# SPEC-05-1: The owner's control chat is told apart by the chat

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

A pure rule on `OwnerNumbers`: a chat is the control chat when it is the line chat of an owner number of kind `extra`. Storage does not change (TP-05 TD-1). The tests also pin what already holds: a control message is stored `owner_app` and `normal`, never sets the unattributed hold, and a Business-app echo keeps holding.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-1 | always | The control chat shall be the chat between the business number and an owner number that is not the business number. The owner numbers shall decide this, and nothing in a message's text shall. |
| FR-INTAKE-05-2 | always | A message in the control chat shall be an answer or an instruction for the session. It shall never be a customer message and shall never make any chat pending. |
| FR-INTAKE-05-3 | always | A message in the control chat shall never hold a send. Only an owner reply to a customer that Deputy cannot tie to a chat holds sends (D30). |
| FR-INTAKE-05-4 | WHEN | When the owner answers a customer from the WhatsApp Business app, the reply shall keep its source "owner from the app", shall stay in the customer's chat, and shall keep holding sends as FR-INTAKE-04-11 and D30 say. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/domain/owner-numbers.ts` | Change | `OwnerNumbers.isControlChat` |
| `test/intake/unit/control-chat.test.ts` | Create | the tests below |

## Reuses
- `src/intake/domain/owner-numbers.ts` `OwnerNumbers`: the class that holds the owner numbers and their kind
- `src/shared/chat-id.ts` `lineChatId`: the chat id of a number
- `src/intake/domain/message.ts` `Message`: `Message.receive` already classifies and marks a stored message
- `src/intake/domain/source-classifier.ts` `classifySource`: unchanged; an owner number's message stays `owner_app`

## Tests first
FR-INTAKE-05-1, FR-INTAKE-05-2, FR-INTAKE-05-3, FR-INTAKE-05-4, written before the code, without it in view, in `test/intake/unit/control-chat.test.ts`. FR-INTAKE-05-1: `isControlChat` is true for the line chat of an `extra` owner number, false for the business number's own chat, false for any customer chat, and false when only a message's text says "I am the owner". FR-INTAKE-05-2: a message received from an `extra` owner number is stored with source `owner_app`, mark `normal`, and its chat is not a customer chat. FR-INTAKE-05-3: the same message leaves `lastUnattributedAt` empty. FR-INTAKE-05-4: an outbound echo from the business number with a customer as counterpart is `owner_app` in the customer's chat, `isControlChat` is false for it, and an echo with no counterpart is still `not_attributable`.

## Build
```ts
// in class OwnerNumbers
isControlChat(chat: ChatId): boolean; // true when chat equals lineChatId(e.number) for an entry e of kind "extra"
```

## Done when
`bun test test/intake/unit/control-chat.test.ts`

## Out of scope
Showing the label to the session (SPEC-05-8); the pending list (SPEC-05-2); recording answers (SPEC-05-7).

## Open questions
None.
