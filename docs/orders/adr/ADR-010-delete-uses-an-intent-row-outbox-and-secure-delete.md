# ADR-010: A delete uses an intent row, an outbox and secure delete

## Status
Accepted (2026-11-24)

## Summary

Order of steps: write an `intent` outbox row; remove the order from the store; write the `order_deleted` mark and set the row `ready`; publish `OrderDeleted {eventId, orderId, draftNumber, chat}` to an in-process sink that `main.ts` connects to Drafts' handler; delete the row after the handler returns.

## Context
FR-ORDERS-02-10a and FR-ORDERS-02-11: after a confirmed delete nothing about the order remains, even after a crash, and a failed delete is never reported as done. Orders must not call Drafts. From Orders TP-02 TD-4 and cross-cutting TD-3.

## Decision
- Order of steps: write an `intent` outbox row; remove the order from the store; write the `order_deleted` mark and set the row `ready`; publish `OrderDeleted {eventId, orderId, draftNumber, chat}` to an in-process sink that `main.ts` connects to Drafts' handler; delete the row after the handler returns.
- A failed remove drops the intent. An unknown outcome is settled at the next redrive by reading the store.
- Redrive runs after each delete, at start, on lease acquisition and after catch-up.
- The shared SQLite adapter sets `PRAGMA secure_delete = ON` at open; Orders' SQLite adapters run `PRAGMA wal_checkpoint(TRUNCATE)` after a remove or outbox purge. Checked in Bun 1.4.4: without the pragma a deleted name stayed in the database file.
- With the spreadsheet store the result carries `spreadsheet_keeps_history`.

## Options considered
- Delete first, then write mark and event: a crash with the spreadsheet store loses the event and Drafts keeps the name.
- Orders calls Drafts directly: a cycle between slices, and a Drafts failure would fail the delete.

## Consequences
- Easier: one path that survives crashes; the file search test proves the erase.
- Harder: an undelivered event keeps the chat number until the next start; `secure_delete` adds some I/O.
