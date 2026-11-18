# ADR-013: Owner numbers keep a separate append-only change log

## Status
Proposed

## Context
L4: owner numbers change only by explicit command, logged with the owner's words, listable at any time. Cross-cutting TD-8: the change comes from the owner's terminal as a pending-change row that the owner process applies. From the Intake TP-04, TD-3.

## Decision
`owner_numbers` holds the current set. `owner_number_log` holds every add and remove: time, action, number (E.164 as stored; matched by line key, ADR-012), kind (`business` or `extra`), label and the typed command. `ApplyPendingChanges` writes both in one transaction. A trigger rejects UPDATE and DELETE on the log. `GetOwnerNumbers` returns the current set and, on request, the log.

## Alternatives
- Soft-delete columns on `owner_numbers`: one table, but a re-added number overwrites its own history and the log is not append-only.
- No log, rely on `pending_changes`: that table is a work queue and may be cleaned.

## Consequences
- Easier: the owner can see who was an owner number on any date.
- Harder: two tables to keep in step, inside one transaction.
- Watch: the typed command is the owner's words here; no agent text is ever recorded in this log.
