# ADR-008: The customer message of a lesson is read by its id, which the drafts log view carries

## Status
Accepted (2026-11-25)

## Summary

The `DraftOutcome` carries `answersMessageId`.

## Context
FR-KNOWLEDGE-02-4: the owner sees the exact wording and the customer message it came from, labeled as customer text. Drafts' log view now carries `answersMessageId` on `approved` and `rejected` entries (Drafts TP-04). Knowledge may call only published ports, and it imports nothing of Drafts: the MCP adapter reads the log and passes Knowledge a `DraftOutcome` that holds the id. From TP-02 TD-2.

## Decision
- The `DraftOutcome` carries `answersMessageId`. Knowledge reads that message through `CustomerMessageReader`, which calls Intake `GetMessages({ids: [id]})`.
- If the entry has no id or Intake no longer holds the message, the result says `message_unavailable`; the lesson can still be proposed.
- The text is read when shown, never stored by Knowledge, so an edited message shows its current text and a wipe has nothing to remove. The MCP adapter wraps it in `<customer_text>`.

## Options considered
- Guess the message from the draft's `proposed` entry time and the newest 50 messages: two reads and a limit in long chats; no longer needed.
- Show no message: breaks FR-KNOWLEDGE-02-4.

## Consequences
- Easier: the message is exact; no stored customer text; no chat-size limit.
- Harder: Knowledge depends on Drafts keeping `answersMessageId` in the log view, and on Intake `GetMessages`.
