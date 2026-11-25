# ADR-019: The memory accepts only the owner's words

## Status
Proposed

## Summary
`remember` appends to memory.md only when its source is the owner's words in the session or a message Deputy stored as written by an owner number in the control chat, and it refuses a text equal to a stored customer message. From [TP-04](../tp/TP-04-pilot-knowledge-files.md) TD-3.

## Context
The memory is read by the agent on every turn, so a line a stranger plants there steers every later answer. Customer text must never reach it (R-KNOWLEDGE-18, FR-KNOWLEDGE-04-18). Deputy cannot know who is speaking in the session (decision D11), but it does know the sender of every stored message and has `IsCustomerText`, which tells whether a text equals a stored customer message after normalization.

## Options considered
- Source is the owner's words in the session, or a stored message from an owner number in the control chat, plus the customer-copy check.
- Source is only the owner's words in the session: simple, but the agent could pass any words and the owner's WhatsApp answers would not count.
- No source: the agent writes any text it likes; one injected message could write the memory.

## Decision
- `remember({ text, source })` where `source` is `{ kind: "session", ownerWords }` or `{ kind: "control_chat", messageId }`.
- A session source needs owner words that pass `parseOwnerWords` (1 to 1000 characters).
- A control chat source needs a stored message that an owner number wrote in the control chat (FR-INTAKE-05-1 to FR-INTAKE-05-3), found through Intake's chat read; a customer message or an unknown id is refused. The text to remember must be contained in that stored message after normalization and on whole-token boundaries, as FR-INTAKE-05-24 says for an answer; otherwise it is refused with `text_not_in_message`. This follows R-KNOWLEDGE-18: the memory takes the owner's own words, not the agent's rewording of them.
- A text equal to a stored customer message is refused, whatever the source.
- The text is 1 to 500 characters (a limit approved by the owner on 2026-11-24); the entry is `<date>: <text>`.

## Consequences
- Whole-file replacement of the memory, for an approved summary, is a different tool (`save_memory`, FRD-04 FR-KNOWLEDGE-04-6); `remember` stays append-only.
- Easier: the owner's WhatsApp answers become knowledge with no extra step; a planted customer sentence is refused when copied whole.
- Harder: a paraphrase of customer text passes the copy check, and the session source cannot prove who spoke; both are known limits, stated in the FRD and the README.
- Watch: the lookup reads the newest 200 messages of each owner number's chat, so an older message is refused as `not_owner_message`.
