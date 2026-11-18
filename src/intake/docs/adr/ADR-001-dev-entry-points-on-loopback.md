# ADR-001: Dev test entry points are loopback HTTP routes that exist only under the dev provider

## Status
Proposed

## Context
FR-INTAKE-01-3, 01-5 and 01-6 need a way to create customer messages, owner replies, repeated and out-of-order messages, forged deliveries and "missed" messages. FR-INTAKE-01-9 says these exist only while the provider is dev and are refused and noted otherwise. Cross-cutting TD-1 forbids giving the agent a tool that injects messages. From the Intake TP-01, TD-1.

## Decision
- A `DevEntryPoints` inbound adapter serves `POST /dev/deliver`, `POST /dev/hold` and `POST /dev/forge` on the loopback listener. It is registered only when the provider is dev.
- `/dev/deliver` builds a delivery body, signs it with the fixed dev secret and calls `ReceiveLiveDelivery`, so a dev message takes the same path as a Kapso one. `/dev/forge` sends the same body with a wrong or missing signature. `/dev/hold` writes a message into the dev provider's holdings (`dev_holdings`) without delivering it, so the next catch-up finds it.
- Under Kapso the routes are not registered. A request to a `/dev/` path on the live listener answers 404 and writes a rejection note with reason `dev_entry_refused` (no content).
- The listener binds loopback only. In dev mode it starts even when live delivery is off, because it is the only test entry.

## Alternatives
- MCP tools (`dev_message`): the agent could then inject messages. Rejected on threat grounds.
- A CLI subcommand writing straight into the database: needs no lease and would bypass the verify path; it cannot test forged deliveries or live-versus-catch-up order.

## Consequences
- Easier: one path for dev and Kapso; e2e tests post to the same routes.
- Harder: a loopback port is open in dev mode.
- Watch: the dev secret is a constant, so dev mode must never be reachable from outside the machine.
