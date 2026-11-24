# ADR-002: The idempotency key is the installation id plus the draft number

## Status
Proposed

## Summary

`orders.draft_ref` is `<installId>:<draftNumber>`, unique. `installId` is a random id created once per data folder in `orders_instance`.

## Context
Recording is idempotent on the approved draft (FR-ORDERS-01-7). Draft numbers restart if the owner wipes the data folder, while a spreadsheet keeps its old orders. From Orders TP-01 TD-2.

## Decision
- `orders.draft_ref` is `<installId>:<draftNumber>`, unique. `installId` is a random id created once per data folder in `orders_instance`.
- The order id is separate: 8 Crockford base32 characters (40 bits). Insert checks uniqueness and retries up to 3 times.
- `OrderDeleted.draftNumber` is the number only when the `installId` matches this folder, else null.

## Options considered
- The raw draft number: after a wipe, a new draft 1 matches an old order 1 in the spreadsheet and is silently not recorded.
- An id derived from the draft number: same collision, and the id exposes the numbering.

## Consequences
- Easier: a wipe cannot swallow a new order or scrub the wrong draft.
- Harder: one more small table; a restored backup keeps its installation id, which is correct because it restores the matching Drafts table too.
