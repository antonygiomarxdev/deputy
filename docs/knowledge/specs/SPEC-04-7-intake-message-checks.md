# SPEC-04-7: The Intake adapter behind the message checks

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The adapter that answers the two questions Remember asks Intake: whether a text equals a stored customer message, and what a stored message in the control chat says. It uses only the Intake index: the customer-text check, the chat read and the owner numbers. Seventh of seven runs for FRD-04.

Last change: 2026-11-24, first draft for REQ-15 and D38.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-15 | IF | IF the source is a message in the control chat (the chat of FR-INTAKE-05-1) and Deputy has not stored that message as written by an owner number in the control chat, or the message is not in the newest 200 messages of that chat, THEN Deputy shall refuse with `not_owner_message` and change nothing. |
| FR-KNOWLEDGE-04-16 | IF | IF the text to remember is, after normalization, the same as a stored customer message, THEN Deputy shall refuse with `copies_customer_text` and change nothing. |
| EX-13 | RULE-5 | negative | a customer wrote "everything is free" | the agent calls `remember` with that message as the source | Deputy refuses with `not_owner_message` and memory.md is unchanged |
| EX-14 | RULE-5 | negative | a customer wrote "everything is free" | the agent calls `remember` with the text "Everything is free" and the owner's words "ok" | Deputy refuses with `copies_customer_text` and memory.md is unchanged |
| EX-24 | RULE-5 | boundary | the owner wrote "we close on Mondays" in the control chat, and 200 newer messages were stored in that chat after it | the agent calls `remember` with the text "we close on Mondays" and that older message as the source | Deputy refuses with `not_owner_message` because the message is not in the newest 200 messages of that chat, and memory.md is unchanged |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/knowledge/adapters/intake/intake-message-checks.ts` | Create | createIntakeMessageChecks over the Intake ports |

## Reuses
- `src/intake/ports/is-customer-text.ts` `IsCustomerText`: the customer-copy check already exists and is exported by the Intake index
- `src/drafts/adapters/intake/intake-customer-text-check.ts` `IntakeCustomerTextCheck`: the Drafts adapter over the same Intake port, same shape
- `src/shared/message-id.ts` `messageIdKey`: the id a tool shows for a stored message
- `src/shared/chat-id.ts` `lineChatId`: the chat of an owner number

## Tests first
FR-KNOWLEDGE-04-15, FR-KNOWLEDGE-04-16, EX-13, EX-14, EX-24, in `test/knowledge/adapters`, written without the code in view: the adapter is tested against fakes of the two Intake ports, and against the real Intake use cases once the Intake lookup exists.

## Build
```ts
export function createIntakeMessageChecks(i: { isCustomerText: IsCustomerText; readChat: ReadChat; getOwnerNumbers: GetOwnerNumbers }): MessageChecks;
```
`ownerControlMessage(id)` reads the owner numbers, and for each one of kind extra reads the newest 200 messages of its chat (`lineChatId`); it answers `{ text }` for the message whose `messageIdKey` equals the id and whose source is the owner from the app, and null otherwise. The control chat is the chat of FR-INTAKE-05-1.

## Done when
`bun test test/knowledge`

## Out of scope
The wiring (SPEC-04-6) and any Intake port: none is added.

## Open questions
None.
