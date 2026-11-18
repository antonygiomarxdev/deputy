# ADR-001: A prepared order travels as a stateless payload

## Status
Proposed

## Context
Drafts holds an order draft as an opaque string and later asks Orders to record it (Drafts TP-01, TP-02). The owner approves exactly what was shown (FR-ORDERS-01-12). From Orders TP-01 TD-1.

## Decision
- `PrepareOrder` validates, resolves catalog items, snapshots name, unit and price, computes the total, and returns a self-contained JSON `PreparedOrderV1` with a version field.
- `RecordOrder` parses it, re-checks the same domain rules and inserts. An unknown version is refused with `payload_invalid`.
- The agent never sees the payload, only the summary.

## Alternatives
- A `prepared_orders` table keyed by a token: puts personal data in Orders before any go, leaves rows for abandoned drafts, and the delete scrub would have to find them.
- Prepare again at record time from the raw input: the catalog may have changed since the owner saw the order, so the record would differ from the approved content.

## Consequences
- Easier: nothing to clean up in Orders; the record equals the shown order.
- Harder: the payload format is a contract with Drafts; keep the version field and a contract test.
