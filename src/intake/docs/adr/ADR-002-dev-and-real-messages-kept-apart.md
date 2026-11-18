# ADR-002: Dev and real messages are kept apart by a dev flag on the message and on the chat key

## Status
Accepted (2026-11-18)

## Context
FR-INTAKE-01-7 keeps stored messages across a provider switch. FR-INTAKE-01-10 and L3 say dev messages are never pending, notified or drafted once the provider is not dev. Inbox, Notify and Drafts must not need to know which provider produced a message. From the Intake TP-01, TD-2.

## Decision
- Every message stores `provider` and `dev` (1 when the provider is dev). `dev` is set at write time from the adapter that produced the message.
- The chat state projection is keyed by `(chat_id, dev)`. Intake's read ports return only the rows whose `dev` equals "the active provider is dev". Under Kapso, dev chats are invisible to `ListChats`; under dev, real chats are invisible.
- `ReadChat` and `ChatExists` see both worlds and mark each message `dev`. A dev message stays readable.
- Intake emits `MessageStored` only for messages stored by the active provider's path.

## Alternatives
- Filter by provider name in every consumer: three slices would each repeat the rule, and the next one would forget it.
- One database file per provider: a switch would hide the other file's messages, against FR-INTAKE-01-7.

## Consequences
- Easier: the rule lives in one repository query; consumers never see a provider name.
- Harder: under dev, previously stored real chats are hidden too. This is stricter than L3 and is the safe side.
- Watch: a chat number that exists in both worlds has two rows; readers must never merge them.
