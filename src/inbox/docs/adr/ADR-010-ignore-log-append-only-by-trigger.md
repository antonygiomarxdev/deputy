# ADR-010: The ignore log is append-only by trigger

## Status
Proposed

## Context
L4 and FR-INBOX-03-11: each ignore and un-ignore is logged with its time and the owner's words, and the owner can list them. The cross-cutting TP uses triggers to keep `drafts_log` append-only (TD-3). From TP-03 TD-3.

## Decision
- Table `ignore_log` has triggers that abort UPDATE and DELETE. Its id is `AUTOINCREMENT`, so order does not depend on the clock.
- `ignored_chats` holds the current list; the repository writes the list rows and the new log entries in one transaction.
- Every command is logged, with `changed = 0` when it changed nothing.
- A migration that rebuilds `ignore_log` recreates the triggers in the same file; the cross-cutting migration test covers it.

## Alternatives
- Append-only by convention (no update or delete method on the repository): a later change or a hand-run statement could rewrite the owner's words without the database objecting.

## Consequences
- Easier: a Deputy bug cannot silently edit the audit trail.
- Harder: two triggers to keep in every table rebuild.
- Watch: an agent with a shell can drop the triggers (D11); they defend against Deputy bugs, not against a hostile local user.
