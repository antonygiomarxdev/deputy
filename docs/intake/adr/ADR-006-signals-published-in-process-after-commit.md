# ADR-006: "Message stored" signals are published in process after commit, grouped per run

## Status
Accepted (2026-11-25)

## Summary

`StoreMessages` returns the list of newly stored, non-history, non-Deputy messages.

## Context
FR-INTAKE-02-9, 03-5, 03-12, 03-17 and 04-10 set when a signal is emitted: once per live message, once per catch-up run that stored new messages, never for history, repeats or Deputy sends, and with the source. Notify recounts from stored data if a signal is lost (cross-cutting TD-7). From the Intake TP-02, TD-4.

## Decision
`StoreMessages` returns the list of newly stored, non-history, non-Deputy messages. The caller (the live use case or the catch-up run) folds them into one `MessageStored { origin, items }`, where `items` groups by chat and source with a count, and publishes it through an `EventPublisher` port after the last transaction of the unit commits. The adapter is an in-process list of handlers wired in `main.ts`. A handler error is logged to stderr and never undoes a store.

## Options considered
- A transactional outbox table: survives a crash between commit and publish, but needs a relay and replay rules. Notify's reminders and counts recompute from stored data, so the gain is small.
- One event per message with a separate "group" event: Notify would have to join them.

## Consequences
- Easier: no new table; the grouping rule is one function.
- Harder: a crash after commit loses one signal; the next reminder or inbox read recounts.
- Watch: handlers must be fast; they run on the store path.
