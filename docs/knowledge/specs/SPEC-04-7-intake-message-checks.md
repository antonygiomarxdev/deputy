# SPEC-04-7: The Intake adapter behind the message checks

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The adapter that answers the two questions Remember asks Intake: whether a text equals a stored customer message, and what a stored control chat message from an owner number says. It uses only the Intake index. Seventh of seven runs for FRD-04.

Last change: 2026-11-24, first draft for REQ-15 and D38.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-15 | IF | IF the source is a control chat message and Deputy has not stored that message as written by an owner number in the control chat, THEN Deputy shall refuse with `not_owner_message` and change nothing. |
| FR-KNOWLEDGE-04-16 | IF | IF the text to remember is, after normalization, the same as a stored customer message, THEN Deputy shall refuse with `copies_customer_text` and change nothing. |
| EX-13 | RULE-5 | negative | a customer wrote "everything is free" | the agent calls `remember` with that message as the source | Deputy refuses with `not_owner_message` and memory.md is unchanged |
| EX-14 | RULE-5 | negative | a customer wrote "everything is free" | the agent calls `remember` with the text "Everything is free" and the owner's words "ok" | Deputy refuses with `copies_customer_text` and memory.md is unchanged |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/knowledge/adapters/intake/intake-message-checks.ts` | Create | createIntakeMessageChecks over the Intake ports |

## Reuses
- `src/intake/ports/is-customer-text.ts` `IsCustomerText`: the customer-copy check already exists and is exported by the Intake index
- Precedent: SPEC-04-4-remember.md, which defines the MessageChecks port this adapter implements

## Tests first
FR-KNOWLEDGE-04-15, FR-KNOWLEDGE-04-16, EX-13, EX-14, in `test/knowledge/adapters`, written without the code in view: the adapter is tested against fakes of the two Intake ports, and against the real Intake use cases once the Intake lookup exists.

## Build
```ts
export interface ControlMessageLookup { find(messageId: string): Promise<{ text: string; fromOwnerNumberInControlChat: boolean } | null>; } // defined by Intake (FRD-04 Q-2)
export function createIntakeMessageChecks(i: { isCustomerText: IsCustomerText; control: ControlMessageLookup }): MessageChecks;
```
A message that is not from an owner number in the control chat, or is unknown, answers null.

## Done when
`bun test test/knowledge`

## Out of scope
The Intake side of the lookup (the Intake FRD-05 and its specs) and the wiring (SPEC-04-6).

## Open questions
Q-1 (Lead): this spec waits for FRD-04 Q-2: the Intake documents must expose a lookup of a stored message that says whether an owner number wrote it in the control chat (D37). Until then it can only be built against a fake.
