# ADR-008: Corrections are a patch, and items are kept by position

## Status
Accepted (2026-11-18)

## Context
FR-ORDERS-02-4, FR-ORDERS-02-6, FR-ORDERS-02-8 and FR-ORDERS-01-14: corrections keep a history, must leave the order valid, and must not re-price items from the current catalog. From Orders TP-02 TD-2.

## Decision
- `change` is an object with any of `status`, `customer_name`, `fulfillment`, `address`, `wanted_date`, `wanted_time`, `notes`, `items`.
- `items` is the new full list. An element is `{keep: position, quantity?}` (snapshot kept) or a new item resolved and snapshotted now. The total is recomputed and logged as its own entry.
- The result must pass the same invariants as a record; otherwise nothing is written. One history entry per changed field, written with the new state in one `update`.
- Any status may follow any other.

## Alternatives
- Replace the whole order and diff: every item is re-resolved, so a quantity correction re-prices the rest.
- One tool per field: many tools, and Drafts' `change_order` carries one `change` object.

## Consequences
- Easier: snapshots survive corrections; one rule set for record and change.
- Harder: two item shapes in the input; a wrong `keep` position is refused.
