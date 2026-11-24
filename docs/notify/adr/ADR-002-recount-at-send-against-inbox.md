# ADR-002: New messages are recounted at send time against Inbox's pending set

## Status
Proposed

## Summary

Notify keeps the hint's message count per chat. When a notice is due it reads Inbox's waiting snapshot (`CountWaiting`: pending, not-ignored chat ids). New messages are the sum of the counts of hinted chats in the snapshot. Other waiting is the snapshot minus those chats. If the sum is 0, no notice is sent.

## Context
A notice must not count a chat the owner already answered, an ignored chat, or a stored dev message, and must never say "new messages from 0 chats" (FR-NOTIFY-01-11, FR-NOTIFY-02-7). Intake's hint says what was stored, not what is still pending. From TP-01 TD-2.

## Decision
Notify keeps the hint's message count per chat. When a notice is due it reads Inbox's waiting snapshot (`CountWaiting`: pending, not-ignored chat ids). New messages are the sum of the counts of hinted chats in the snapshot. Other waiting is the snapshot minus those chats. If the sum is 0, no notice is sent.

## Options considered
- Trust the hint and use Inbox only for the waiting count. It reports answered, ignored and dev chats as new and can say "from 0 chats".
- Ignore the hint and read `ListChats({customerMessageSince})` at each notice. `ChatStateView` has no message count, so "5 new messages" cannot be given. Counting would need one message read per chat, against a limit of 100 requests per minute.

## Consequences
- Easier: Notify never defines what pending means; Inbox does.
- Harder: one Inbox read per notice. Inbox exposes chat ids only (no text, no names).
- Watch: the Inbox read can fail (`InboxReadFailed`). Then a batch notice leaves no chat out, omits other-waiting and carries the caveats `may_include_ignored` and `waiting_may_be_incomplete` (FRD-02 edge case); a reminder is skipped and retried.
