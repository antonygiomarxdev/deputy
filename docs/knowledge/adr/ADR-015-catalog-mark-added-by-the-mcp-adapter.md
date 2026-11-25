# ADR-015: The MCP adapter adds the "catalog changed" mark to listed drafts

## Status
Accepted (2026-11-25)

## Summary

The MCP adapter serving `list_drafts` calls Drafts `ListDrafts`, then Knowledge `CatalogChangedSince({ since: [each draft's madeAt] })`, and merges one flag per draft into the tool result.

## Context
FR-KNOWLEDGE-01-14: when the agent lists a waiting draft, Deputy marks it "catalog changed since this draft" if the catalog was saved after the draft was written. Knowledge reads the drafts log (FR-KNOWLEDGE-02-1), so Drafts must not call Knowledge: the two slices would depend on each other. From TP-01 TD-8.

## Decision
- The MCP adapter serving `list_drafts` calls Drafts `ListDrafts`, then Knowledge `CatalogChangedSince({ since: [each draft's madeAt] })`, and merges one flag per draft into the tool result. Reply and order drafts both get it.
- `CatalogChangedSince` reads the catalog fingerprint once and answers for every time (ADR-005).
- If the Orders `revalidate` flag is also set, the merged mark is the OR of both.
- Drafts' `ListDrafts` result carries each draft's `madeAt`; no Drafts port to Knowledge exists.

## Options considered
- A Drafts outbound port to Knowledge: a slice cycle, and the architecture test of TP-02 (no Drafts use case has a port to Knowledge) fails.
- Only order drafts, from Orders' `revalidate`: reply drafts quote prices too and would go unmarked.

## Consequences
- Easier: one-way dependency; both draft kinds covered; one catalog read per listing.
- Harder: a few lines of merge logic in the MCP adapter, tested end to end.
