# ADR-003: A scheduler ticks every 30 seconds and Tick computes what is due

## Status
Proposed

## Context
Notices depend on four clocks: the batching period, the reminder period, quiet periods and the outage rule. From TP-01 TD-3; cross-cutting TD-7 (a scheduler adapter calls `Tick`).

## Decision
The scheduler adapter calls `Tick` every 30 seconds. `Tick` reads the clock and its state, decides what is due, and sends at most one notice. Ticks do not overlap. 30 seconds is half of the smallest batching period the owner can set (1 minute), so a notice is late by at most half of the smallest period. An Inbox read happens only when a notice may be due.

## Alternatives
- One timer per due time. It is exact, but every setting change, event and quiet-period edge must re-arm it, a missed re-arm loses a notice, and the `Clock` port offers only `now()` and `sleep(ms)`, so tests would need a fake timer API.

## Consequences
- Easier: one entry point; a fake clock tests every FR.
- Harder: a due notice can wait up to 30 seconds.
- Watch: a tick that runs late is safe, because all due times are absolute instants.
