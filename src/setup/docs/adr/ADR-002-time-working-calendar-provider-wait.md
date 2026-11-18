# ADR-002: Time is recorded as events and computed on read

## Status
Proposed

## Context
The v1 target is under 30 minutes from the first instruction to a passing round trip, with the provider's own waits reported apart (PRD, FR-SETUP-01-9, FR-SETUP-01-10). The owner can stop for days. The optional live-delivery step is timed apart. From Setup TP-01, TD-2.

## Decision
- Every Setup tool call writes one `setup_activity` row. Provider waits are rows in `setup_provider_wait` with kind `connect`, `delivery` or `live`.
- Working time is the sum of gaps between consecutive activity rows, each gap capped at 10 minutes (one third of the 30-minute target), minus provider wait inside the gap. Calendar time is last minus first. Total is calendar time to the passing round trip minus `live` time. The summary shows working time, calendar time and provider wait apart.
- The first instruction is the first time the status is shown in the owner process. `connect` wait starts when the owner says they asked the provider to connect, and ends at the first probe that passes with the history sync complete (the observed time). `delivery` wait starts when the owner says they sent the test message and ends at Intake's `storedAt` of that message.
- The computation is one pure function in `domain/` over the rows, tested with a fake clock.

## Alternatives
- A running counter of working seconds: cannot be recomputed when the rule changes, loses a step's time on a crash, and cannot be audited.
- Calendar time only: an owner who stops for days looks slow, and the provider's wait would count against the owner.

## Consequences
- Easier: every number can be re-derived and explained; changing the cap needs no migration.
- Harder: a table that grows by one row per call (small: a setup is tens of calls).
- Watch: the end of the connect wait is late by up to the interval between checks; the guide asks for a check every minute and the summary says "up to".
