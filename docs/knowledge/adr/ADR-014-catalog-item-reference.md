# ADR-014: A catalog item reference is the id cell, or the folded name

## Status
Proposed

## Summary

The reference is never null.

## Context
Orders stores a reference to a catalog item with a snapshot and re-reads the item later by that reference (`GetCatalogItems`, FR-ORDERS-01-2, FR-ORDERS-01-14). The owner's file or sheet has no key that Deputy controls. From TP-01 TD-7.

## Decision
- The reference is never null. With an `id` column in the mapping it is `id:<cell>`; otherwise `n:<folded name>`, using the folding of ADR-002.
- A repeated reference (blank or equal ids, rows with one name) gets the suffix `#2`, `#3` in file order.
- References do not change when price, unit, availability or notes change.
- When no column has the role `id`, the mapping confirmation carries the notice `ref_by_name`: renaming a product changes its reference, and the owner may add an id column.
- `GetCatalogItems({ refs })` returns a map from each ref to its item, or `null`, from one read of the catalog (at most 100 refs).

## Options considered
- The row number: sorting the file or deleting a row changes every reference below it, so an order points at the wrong product.
- A reference Deputy writes into a hidden column or table: it writes into the owner's file or sheet unasked, and a copied row duplicates the reference.

## Consequences
- Easier: no state and no write; Orders can compare snapshots per item.
- Harder: without an id column a rename breaks the link (the order keeps its snapshot, FR-ORDERS-01-14); rows sharing a name that are reordered swap suffixes.
