# ADR-012: Spreadsheet layout with atomic writes and strict reads

## Status
Proposed

## Context
FR-ORDERS-03-5a, FR-ORDERS-03-5 and the edge case of a sheet edited by hand. The Sheets API has no transactions across calls, but `spreadsheets.batchUpdate` writes all of its requests or none. From Orders TP-03 TD-2.

## Decision
- Tabs `Orders` (17 fixed-code columns, `items_json` is the source of truth, `items` is a readable line) and `Order history`.
- One `batchUpdate` per write: `AppendCells`, `UpdateCells` and `DeleteDimension` (bottom-up). Only `stringValue` and `numberValue` are written, never `formulaValue`.
- Header row must match exactly, else `layout_mismatch` and no write. Tabs are created only when absent or empty.
- Rows are restored through the domain invariants. A bad row is `unreadable` with its reason; a hand-edited `items` line is `items_text_edited`. Retyped dates (serial numbers) and status case are tolerated.

## Alternatives
- A third `Order items` tab: breaks the two tabs of the cross-cutting TP and spreads one atomic write over three tabs with shifting rows.
- Items as lines in one cell: parsing quantity, unit and price back is guesswork, and Deputy never guesses a price.

## Consequences
- Easier: a record and its history are written together or not at all; a hand edit never shows wrong data as right.
- Harder: two columns hold the items; the owner who edits only the readable one gets an unreadable row.
