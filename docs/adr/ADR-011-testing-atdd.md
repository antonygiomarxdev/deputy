# ADR-011: ATDD with FR-named tests, a fake Kapso server and an injected clock

## Status
Proposed

## Context
D13: the FRDs' Given/When/Then lines are acceptance criteria and become tests first. Rate limits, pagination, echoes and outages cannot be produced on demand with a live number. The existing e2e harness spawns the server over stdio. From TP TD-11.

## Decision
- Each Given/When/Then line becomes a test titled with the FR id it covers, written before the code.
- An architecture test parses imports under `src/` and fails when `domain` imports outside `domain` and `src/shared/`, when `application` or `ports` import `adapters`, when a slice imports another slice's file other than its `index.ts`, or when an adapter is instantiated outside `src/main.ts`.
- Layers: domain unit tests with no I/O; use case acceptance tests through inbound ports with in-memory adapters; the same repository contract tests against in-memory and SQLite adapters; slice tests with a fake provider; end-to-end tests that start the server over stdio with the dev provider and a fake Kapso HTTP server (cursors, `X-RateLimit-*`, `429` with `Retry-After`, `business_app` echoes, delays, outages); use case tests with an in-memory `OwnerLease`; a two-process test for the owner lock; crash tests between "mark used" and the provider call, between "mark used" and the order record, and between an order delete and its scrub; catch-up tests (a live-stored message with two earlier ones missing, resume after `429`, a provider clock an hour off, an echo found by sweep 2 without `last_active` moving, Deputy off for 10 days with a 7-day inbox window loses nothing, and raising the window triggers no extra reads); a command-line change applied by the owner process on its next tick; a send held when the lease is lost before the provider call and when `CatchUpChat` times out; a lease takeover race between two losers.
- Time-dependent logic takes an injected clock.
- One live check with a real number and a real echo runs by hand before each release.

## Alternatives
- Contract tests on recorded real Kapso responses only: cannot make rate limits, outages or new echo shapes on demand; recordings go stale. They can complement the fake server.

## Consequences
- Easier: a missing FR shows as a missing test; failures are reproducible.
- Harder: the fake Kapso server is code to keep in step with the real API.
- Watch: drift between the fake and Kapso; the live check is the guard.
