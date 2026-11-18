# ADR-005: Catch-up by two sweeps on the provider's clock, paged in full

## Status
Proposed

## Context
D12 makes catch-up the default way messages arrive. Kapso lists conversations by `last_active_after`, then messages per conversation, newest first, with cursors; the message list also filters by `direction` and has no time filter. Free plan: 100 requests per minute; `429` carries `Retry-After`; responses carry `X-RateLimit-Remaining` (`docs/research/kapso.md`). Whether an owner echo updates a conversation's `last_active` is unverified. From TP TD-5.

## Decision
- Run on start, every N minutes (default 2, minimum 1, FR-INTAKE-03-21), and when the owner asks. At most one runs at a time (single-flight in Intake): the timer, `check_messages` and the pre-send `CatchUpChat` share it. A process that is not the owner runs none (ADR-002).
- Sweep 1: conversations with `last_active_after = mark - overlap`, then each conversation's messages. Sweep 2: the number's outbound messages (`direction=outbound`), which carry owner echoes. Sweep 2 means correctness does not depend on `last_active` moving on an echo.
- Never stop at the first known message. Each sweep pages its whole time window (newest first, 100 per page, until a message is older than `mark - overlap`) and de-duplicates by `(provider, message id)`.
- Each sweep keeps its own mark (conversations; outbound messages), a provider timestamp, not the local clock. A mark advances as each unit finishes (a conversation's pages; a page of outbound messages), reading conversations oldest first, so a run cut short by `429` or a timeout resumes where it stopped. The overlap (default 10 minutes) covers provider lag.
- The first connect imports the whole retention window the provider offers, flagged as history (FR-INTAKE-03-1, FR-INTAKE-03-11). After that every run reads from `mark - overlap`, however long Deputy was off. The inbox window (D3) only decides what counts as pending; it never limits catch-up, so raising it needs no backfill.
- Read `X-RateLimit-Remaining` and slow down when low. On `429`, wait `Retry-After`, mark the run incomplete, retry. Status is "complete" or "failed" with a reason; an incomplete run is "failed, rate limited, retrying". Readers show "up to date as of <time>". A time limit ends a stuck run as "failed, timeout".
- A run that stores new messages emits one "message stored" signal; history messages emit none.

## Alternatives
- One sweep (conversations only): misses an echo that does not move `last_active`, so Deputy could answer over the owner.
- A mark from the local clock: skew beyond the overlap loses messages, and a run that fails never advances the mark.
- Webhook only: rejected by D12; needs a public address and misses messages while the computer is off.

## Consequences
- Easier: no public address; echoes and customer messages share one path; a large backlog finishes across runs.
- Harder: a few more requests per run; after a long absence the first run reads every day since the mark (paced by the rate limit).
- Watch: late echoes outside the overlap window; the provider's real retention; one live check of `last_active` on an echo before launch.
