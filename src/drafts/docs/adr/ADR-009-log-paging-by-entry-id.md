# ADR-009: The log is paged by entry id

## Status
Proposed

## Context
FR-DRAFTS-04-6: newest first, filtered by chat. A very long log is shown newest first with an offer to go further back. Two events in one second keep their order (FRD-04 edge cases). Knowledge reads the log too (FR-DRAFTS-04-3). From TP-04 TD-2.

## Decision
- Order and paging use the entry id (a rising integer), never the time.
- `ReadDraftLog({ chat?, limit?, before?, after? })`: `before` pages back for the owner. `after` lets Knowledge read forward from its last entry id. Default limit 20, maximum 100.
- The result carries `nextBefore` when older entries exist.

## Alternatives
- Offset and limit: a new entry shifts every page while the owner reads back.
- Order by time: two events in one second can swap.

## Consequences
- Easier: stable pages; Knowledge keeps one number as its cursor.
- Harder: the tool has one input more than the cross-cutting TP lists (`before`). `after` is for the Knowledge adapter only.
