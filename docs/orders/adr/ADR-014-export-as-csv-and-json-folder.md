# ADR-014: Export as a folder of CSV files and one JSON file

## Status
Proposed

## Summary

A folder `exports/orders-<UTC date-time>/` with `orders.csv`, `order_items.csv`, `order_history.csv`, a lossless `orders.json` and, if needed, `orders_unreadable.csv`.

## Context
FR-ORDERS-03-6 and FR-ORDERS-03-7: all orders with history, in a form the owner can read and keep; partial or failed exports are reported as such. From Orders TP-03 TD-4.

## Decision
- A folder `exports/orders-<UTC date-time>/` with `orders.csv`, `order_items.csv`, `order_history.csv`, a lossless `orders.json` and, if needed, `orders_unreadable.csv`.
- CSV by `papaparse` `unparse` in the export adapter, with `escapeFormulae`, a byte-order mark, and a delimiter and decimal mark from the system (`;` and `,` when the system decimal mark is a comma). `export_orders` accepts a `delimiter` override.
- Files go to a temporary folder and are renamed as one step. A failure leaves no export. Unreadable rows make the result `complete: false`.
- The result returns the location and counts, never content.

## Options considered
- One JSON file: not openable in a spreadsheet.
- An `.xlsx` through a library: a heavy dependency for a one-off file, and a binary file is harder to test.

## Consequences
- Easier: opens correctly in Excel in comma-decimal locales; formulas in customer text are neutralized.
- Harder: five files; a wrong locale guess needs the override.
