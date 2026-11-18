# ADR-006: After an unknown write outcome, check the store before saying anything

## Status
Proposed

## Context
A spreadsheet write can time out after the row was stored (FR-ORDERS-01-8, FR-ORDERS-01-16). From Orders TP-01 TD-6.

## Decision
- On a failed or timed-out write, `RecordOrder` reads the store once by `draft_ref`. Found: return the order. Not found: `store_unavailable`. Read failed too: `outcome_unknown`.
- Every record starts with the same lookup, so a retry never creates a second order.
- Writes of one process run through a `WriteSerializer` (a promise chain).
- The sheet client retries a write only on HTTP 429 (not processed), never on a timeout or 5xx.

## Alternatives
- A write-ahead intent table: after a crash the sheet still has to be searched, so the table adds no information and adds a cleanup path.

## Consequences
- Easier: one lookup rule for retries, redrive and crashes.
- Harder: `outcome_unknown` can reach the owner; Drafts must show it and wait for the owner (flagged to the lead).
