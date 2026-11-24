# ADR-011: One repository port, and filtering in the use case

## Status
Proposed

## Summary

`OrderRepository` has whole-order operations only: `findByDraftRef`, `get`, `readAll`, `insert`, `update`, `remove`, `count`.

## Context
R-ORDERS-10: every behavior is the same with either store. Cross-cutting TD-3 puts orders behind one repository with a SQLite and a spreadsheet adapter. From Orders TP-03 TD-1.

## Decision
- `OrderRepository` has whole-order operations only: `findByDraftRef`, `get`, `readAll`, `insert`, `update`, `remove`, `count`.
- A `RoutingOrderRepository` reads `orders_store` on each call and forwards to one adapter.
- `ListOrders` filters, sorts and pages once, on the result of `readAll`.
- Both adapters pass one contract test suite.

## Options considered
- Query methods per adapter: two implementations of each filter that must agree, so the requirement rests on tests, not on construction.
- SQLite primary with a spreadsheet mirror: two copies; a list could show orders the owner changed or deleted in the sheet, which breaks FR-ORDERS-03-5.

## Consequences
- Easier: one behavior by construction; a third store is one adapter.
- Harder: every list reads all orders; at about 5,000 orders a sheet read passes the 2 MB advice. Output is paged.
