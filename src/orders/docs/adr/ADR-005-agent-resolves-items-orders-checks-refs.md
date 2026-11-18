# ADR-005: The agent resolves items; Orders checks the reference

## Status
Proposed

## Context
Each item has a catalog reference or the explicit "not in catalog" mark, and the owner decides about the mark (FR-ORDERS-01-2, FR-ORDERS-01-3). From Orders TP-01 TD-5.

## Decision
- Each input item carries `catalog_ref` or `not_in_catalog: true`. `PrepareOrder` checks every ref with one batched `CatalogLookup.resolve` and snapshots the result.
- An item with neither is refused with `item_unresolved:<position>`. A not-in-catalog item has no price, so the total is "to be confirmed".

## Alternatives
- Orders resolves by name and takes a single match: "pork tamales" would match "pork tamales (spicy)" and the owner approves a wrong item.
- Orders returns candidates: needs a name search in Knowledge's port that duplicates `find_catalog_items`.

## Consequences
- Easier: Orders needs only a lookup by reference.
- Harder: the agent makes two steps; it can set the mark without the owner deciding (D11, accepted; the mark shows in the summary).
