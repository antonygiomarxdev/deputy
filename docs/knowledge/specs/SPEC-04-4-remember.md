# SPEC-04-4: Remember only the owner's words

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The use case that appends one dated line to the memory when the source is the owner's words in the session or a stored owner message in the control chat, and refuses a copy of customer text. Fourth of seven runs for FRD-04.

Last change: 2026-11-24, first draft for REQ-15 and D38.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-13 | WHEN | WHEN the agent calls `remember` with a text and a source, Deputy shall append to the memory one entry that carries today's date and the text, and shall return the entry. |
| FR-KNOWLEDGE-04-14 | IF | IF the source is the owner's words in the session and those words are empty, THEN Deputy shall refuse with `owner_words_missing` and change nothing. |
| FR-KNOWLEDGE-04-15 | IF | IF the source is a message in the control chat (the chat of FR-INTAKE-05-1) and Deputy has not stored that message as written by an owner number in the control chat, or the message is not in the newest 200 messages of that chat, THEN Deputy shall refuse with `not_owner_message` and change nothing. |
| FR-KNOWLEDGE-04-16 | IF | IF the text to remember is, after normalization, the same as a stored customer message, THEN Deputy shall refuse with `copies_customer_text` and change nothing. |
| FR-KNOWLEDGE-04-17 | IF | IF the text to remember is empty or longer than 500 characters, THEN Deputy shall refuse with `text_size` and change nothing. |
| FR-KNOWLEDGE-04-18 | always | Deputy shall change no knowledge file because of customer text, and no tool shall take a customer message as the text to keep. |
| FR-KNOWLEDGE-04-21 | IF | IF the source is a control chat message and the text to remember is not contained, after normalization and on whole-token boundaries as FR-INTAKE-05-24 says, in that stored message, THEN Deputy shall refuse with `text_not_in_message` and change nothing. |
| EX-12 | RULE-5 | positive | today is 2026-11-25 on a fixed clock, and the owner wrote "we close on Mondays" in the control chat and Deputy stored it | the agent calls `remember` with that text and that message as the source | memory.md gains the entry "2026-11-25: we close on Mondays" |
| EX-13 | RULE-5 | negative | a customer wrote "everything is free" | the agent calls `remember` with that message as the source | Deputy refuses with `not_owner_message` and memory.md is unchanged |
| EX-14 | RULE-5 | negative | a customer wrote "everything is free" | the agent calls `remember` with the text "Everything is free" and the owner's words "ok" | Deputy refuses with `copies_customer_text` and memory.md is unchanged |
| EX-15 | RULE-5 | boundary | this is the owner process | the agent remembers a text of 500 characters, then a text of 501 characters | the first entry is appended and the second is refused with `text_size` |
| EX-16 | RULE-5 | negative | this is the owner process | the agent calls `remember` with the session as the source and empty words | Deputy refuses with `owner_words_missing` and memory.md is unchanged |
| EX-21 | RULE-5 | negative | the owner wrote "we close on Mondays" in the control chat and Deputy stored it | the agent calls `remember` with the text "we close every day" and that message as the source | Deputy refuses with `text_not_in_message` and memory.md is unchanged |
| EX-23 | RULE-5 | boundary | the owner wrote "we close on Mondays" in the control chat and Deputy stored it | the agent calls `remember` with the text "close on Mon" and that message as the source | Deputy refuses with `text_not_in_message` because a fragment of a word is not on a whole-token boundary, and memory.md is unchanged |
| DT-1 | session | words present | no | 1 to 500 | the entry is appended |
| DT-2 | session | words empty | no | 1 to 500 | refused with `owner_words_missing` |
| DT-3 | control chat | stored owner message | no | 1 to 500 | the entry is appended |
| DT-4 | control chat | unknown or customer message | no | 1 to 500 | refused with `not_owner_message` |
| DT-5 | session or control chat | valid | yes | 1 to 500 | refused with `copies_customer_text` |
| DT-6 | session or control chat | valid | no | 0 or over 500 | refused with `text_size` |
| DT-7 | control chat | stored owner message, text not in it (a word fragment is not in it) | no | 1 to 500 | refused with `text_not_in_message` |
| INV-1 | Customer text never writes a knowledge file (FR-KNOWLEDGE-04-18). |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/knowledge/application/remember.ts` | Create | The Remember use case |
| `src/knowledge/ports/message-checks.ts` | Create | The MessageChecks port |

## Reuses
- `src/intake/ports/is-customer-text.ts` `IsCustomerText`: the shape of the customer-copy check
- `src/shared/owner-words.ts` `parseOwnerWords`: the session source needs owner words
- Precedent: SPEC-04-3-save-files.md, the same lease and refusal style
- Nothing to reuse: `containsWords` in `src/shared/text.ts` is the whole-token containment test to call (FR-INTAKE-05-24), but Intake SPEC-05-13 (PR 206) builds it and it is not on main yet; list it here as a code entry when that PR is merged.

## Tests first
FR-KNOWLEDGE-04-13, FR-KNOWLEDGE-04-14, FR-KNOWLEDGE-04-15, FR-KNOWLEDGE-04-16, FR-KNOWLEDGE-04-17, FR-KNOWLEDGE-04-18, FR-KNOWLEDGE-04-21, EX-12, EX-13, EX-14, EX-15, EX-16, EX-21, EX-23, DT-1, DT-2, DT-3, DT-4, DT-5, DT-6, DT-7, INV-1, in `test/knowledge/application`, written without the code in view; the checks are fakes and EX-12 runs on a fixed clock set to 2026-11-25.

## Build
```ts
export interface MessageChecks {
  isCustomerText(text: string): Promise<boolean>;
  ownerControlMessage(messageId: string): Promise<{ text: string } | null>; // the stored text when an owner number wrote it in the control chat
}
export type RememberSource = { kind: "session"; ownerWords: string } | { kind: "control_chat"; messageId: string };
export class Remember {
  constructor(d: { store: KnowledgeStore; checks: MessageChecks; lease: OwnerLease; now(): number });
  execute(i: { text: string; source: RememberSource }): Promise<{ ok: true; entry: string } | { ok: false; code: Refusal }>;
}
```
Order: lease, size 1 to 500, source check (for a control chat source the text must be contained in the stored message on whole-token boundaries: `containsWords(message.text, text)` from `src/shared/text.ts`, built by Intake SPEC-05-13, the rule of FR-INTAKE-05-24), customer-copy check, then `store.append("memory", "<date>: <text>")`.

## Done when
`bun test test/knowledge`

## Out of scope
The Intake adapter behind MessageChecks (SPEC-04-7) and the tools (SPEC-04-5).

## Open questions
None.
