# ADR-001: Pending counts live in the memory of the owner process

## Status
Proposed

## Context
Notify counts new messages per chat from Intake's `MessageStored` hint until a notice is sent (FR-NOTIFY-01-2, FR-NOTIFY-01-7). The question is whether those counts are stored. From TP-01 TD-1; cross-cutting TD-2 (one owner process).

## Decision
The counts are held in a `NoticeSession` object created by `StartNoticeSession` at each lease acquisition. They are not written to SQLite. Only `notice_state` (last delivered time, failures, announced outage) is stored. A restart or a lease handover starts with no pending counts.

## Alternatives
- A table `notice_pending(chat, messages, first_stored_at)`. Rejected: after a crash or a handover the rows belong to a session that no longer exists, so the new process would announce old messages as "new" and need a rule to discard them. That is the in-memory behavior plus a table, a migration and a write per catch-up.

## Consequences
- Easier: no migration, no clean-up, no stale rows.
- Harder: a crash in the middle of a batch loses the "new" label for that batch. The chats stay pending in Inbox, so the next notice counts them as waiting and nothing is lost (principle 3).
- Watch: `StartNoticeSession` must run on every acquisition, before the scheduler starts.
