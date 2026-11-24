# ADR-008: A rate limit ends the run, records the retry time, and the scheduler resumes it

## Status
Accepted (2026-11-18)

## Context
FR-INTAKE-03-19 and 03-20: slow down when few requests remain, wait as long as the provider says on a refusal, keep what is stored, and tell the owner only after 10 minutes. Reads and sends share one request budget (cross-cutting TD-4). From the Intake TP-03, TD-2.

## Decision
- The Kapso adapter paces itself. Below a reserve of 10 remaining requests it waits for the next provider minute before a read. Sends skip the reserve, so a send is never starved by a read.
- On `429` the adapter throws `rate_limited` with `retryAfterMs`. The run stops at that unit, keeps all stored messages and saved marks, writes status `failed`, reason `usage_limit`, sets `rate_limited_since` once and `retry_at = now + retryAfterMs`, and returns.
- The scheduler adapter sleeps until `retry_at`, then runs again. The owner-facing flag `tellOwner` turns true only when `now - rate_limited_since` passes 10 minutes.
- A run has a budget of 60 seconds. A run that ends on budget while making progress ends as `failed`, reason `catching_up`, and the scheduler starts the next one at once.

## Alternatives
- Sleep inside the run until `Retry-After` passes: simpler, but the run holds the single-flight lock, an inbox read waits on it, and a long wait cannot be told apart from a hang.
- Sleep in the run for short limits (10 seconds or less) and end the run for longer ones: two paths to test, and the short sleep still holds the lock.

## Consequences
- Easier: no use case sleeps; fake-clock tests drive the retry.
- Harder: the scheduler owns a second timer (`retry_at`).
- Watch: `CatchUpChat` never waits for a rate limit; it fails and Drafts holds the send.
