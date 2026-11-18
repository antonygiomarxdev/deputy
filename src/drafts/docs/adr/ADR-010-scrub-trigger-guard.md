# ADR-010: The scrub exception is guarded in the trigger

## Status
Proposed

## Context
D15 and L6: deleting an order replaces the owner's words in its log entries with "deleted". FR-DRAFTS-04-7: entries are never changed or removed. Cross-cutting TD-3 allows one narrow, tested exception. From TP-04 TD-3.

## Decision
- A `BEFORE DELETE` trigger always aborts. A `BEFORE UPDATE` trigger aborts unless the change is exactly: `scrubbed` from 0 to 1, `owner_words` unchanged or set to "deleted", every other column equal, and the row belongs to an order (`draft_kind = 'order'`, or kind `order_command` or `order_deleted`).
- The only code that updates is `scrubOrder(orderId, draftNumber)` in the SQLite log adapter, called by `OnOrderDeleted`. The same Drafts transaction sets the order text, its normalized copies, the approval text, the approval owner words and the approval text hash in `drafts` and `approvals` to "deleted" and clears `order_payload`.
- Order entries never hold draft text (a CHECK enforces it), so the owner's words are the only personal data in the log.

## Alternatives
- Keep the order owner words in a side table and delete the row, so the log table stays fully immutable. Not chosen: it adds a join to every read, a second place a word can sit, and departs from the exception that D15 and cross-cutting TD-3 describe.

## Consequences
- Easier: the exception is visible in the schema and tested by trying every other update.
- Harder: a future column must be added to the trigger's equality list, or updates of it fail (the safe error).
