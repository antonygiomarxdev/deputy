# ADR-009: The log is paged by entry id

## Status
Proposed

## Context
FR-DRAFTS-04-6: newest first, filtered by chat. A very long log is shown newest first with an offer to go further back. Two events in one second keep their order (FRD-04 edge cases). Knowledge reads the log too (FR-DRAFTS-04-3). From TP-04 TD-2.

## Decision
- Order and paging use the entry id (a rising integer), never the time.
- `ReadDraftLog({ chat?, limit?, before?, after? })`: `before` pages back for the owner. `after` lets Knowledge read forward from its last entry id. Default limit 20, maximum 100. Why: an entry holds the proposed and final text and the owner's words, roughly 150 to 300 tokens (an estimate, not measured), so 20 entries are 3,000 to 6,000 tokens, one screenful for the agent; 100 is 15,000 to 30,000 tokens, the most one tool result should carry. Older entries are one `before` call away.
- The result carries `nextBefore` when older entries exist.

## Alternatives
- Offset and limit: a new entry shifts every page while the owner reads back.
- Order by time: two events in one second can swap.

## Consequences
- Easier: stable pages; Knowledge keeps one number as its cursor.
- Harder: the tool has one input more than the cross-cutting TP lists (`before`). `after` is for the Knowledge adapter only.
