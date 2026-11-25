# ADR-004: A confirmed change is written as cell operations with a row check

## Status
Accepted (2026-11-25)

## Summary

The domain finds the row (by the cells the proposal showed) and produces `CellOp`s, each with the whole row as read.

## Context
An apply changes one cell or adds one row in a catalog the owner also edits by hand, or one section of the profile (FR-KNOWLEDGE-01-10, FR-KNOWLEDGE-01-13). A change can wait days for the go. It must not lose the owner's other content. From TP-01 TD-4.

## Decision
- The domain finds the row (by the cells the proposal showed) and produces `CellOp`s, each with the whole row as read. The store adapter re-reads, checks the row is unchanged, then writes.
- File store: parse with papaparse, change the cell, `unparse` with the same delimiter and line break, keep the byte-order mark and the final line break, parse the output and check it equals the expected table, write a temp file in the same folder, copy the old file to `catalog.csv.deputy-bak` (one copy, overwritten), rename the temp over the file.
- Sheet store: re-read the row, compare, then update that one cell with `USER_ENTERED`.
- Order of effects: transaction 1 marks the proposal `applying` and logs `apply_requested` with the owner's words; the store writes; transaction 2 marks `applied` and logs `applied`, or returns it to `waiting` and logs `apply_failed` with a code. A crash leaves `applying`; the next proposal use case reconciles it by reading the target.
- Values: text starting with `=`, `+`, `-` or `@`, or containing a tab or carriage return, is refused (`value_unsafe`). A price is a plain decimal, written with the mapping's decimal mark and read back to the same number, else `value_invalid`.

## Options considered
- Replace the whole table: overwrites formulas and formats on a sheet, and an edit the owner saved while the change waited.
- Patch the file text at a byte offset: papaparse gives no per-row offset (checked: `meta.cursor` equals the input length), so Deputy would need a CSV scanner of its own, which cross-cutting TD-12 rejects.

## Consequences
- Easier: the owner's hand edits survive; a failed write leaves file and proposal intact; the log shows the words before anything changes.
- Harder: a sheet apply costs two reads and a write against the 60 reads per minute user quota; a program holding the file open (Excel on Windows) makes the write fail with `write_failed`.
