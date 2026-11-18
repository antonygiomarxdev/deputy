# ADR-009: A delete needs a stored pending request

## Status
Proposed

## Context
FR-ORDERS-02-10: nothing is deleted until the owner explicitly confirms. Drafts passes a `confirm` flag the agent controls. From Orders TP-02 TD-3.

## Decision
- `confirm: false` passes the identification check, stores `order_pending_deletes(order_id, requested_at)` and returns a statement of the order.
- `confirm: true` needs a pending request for that order made at most 10 minutes earlier (a normal reply fits; an owner who walks away should not leave a live "yes"). It consumes the request. Without one the reason is `delete_not_requested`.

## Alternatives
- Trust the flag: an agent passes `confirm: true` on the first call and the owner was never asked.
- A signed token: needs a key and a signature routine for a problem a table with a short life already solves.

## Consequences
- Easier: a delete cannot happen in one call.
- Harder: the agent can still fake the owner's "yes" (D11, accepted).
