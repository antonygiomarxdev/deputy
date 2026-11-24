# SPEC-01-6: A scheduler calls Tick every 30 seconds

Status: Draft
Rests on: ../frd/FRD-01-batched-notice.md

## Summary

A small scheduler adapter that calls `Tick` every 30 seconds while this process is the owner (ADR-003). Ticks never overlap and a tick that throws is logged and the next one runs. It starts and stops with the lease.

Last change: 2026-11-24, first draft for the local pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-NOTIFY-01-12 | always | The worst-case delay between a customer writing and the notice that counts the message is one catch-up period plus the batching period (with the defaults, 2 plus 10 minutes), when live delivery is off. Quiet periods can add to it. (R-NOTIFY-2) |
| FR-NOTIFY-01-14 | always | In the local pilot, notices are always on with the default batching period of 10 minutes. Reminders (FR-NOTIFY-01-10), quiet periods, the owner's controls (FRD-02) and the outage notices of FRD-03 are deferred until after the pilot. (REQ-15, D34) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/notify/adapters/scheduler/notice-scheduler.ts` | Create | `NoticeScheduler` |
| `test/notify/unit/notice-scheduler.test.ts` | Create | the tests below |

## Reuses
- `src/intake/adapters/scheduler/catch-up-scheduler.ts` `CatchUpScheduler`: the start, stop and generation pattern this scheduler copies
- `src/shared/clock.ts` `Clock`: `sleep` between ticks
- Precedent: SPEC-01-3-tick.md, the use case this scheduler calls

## Tests first
FR-NOTIFY-01-12, FR-NOTIFY-01-14, written before the code, without it in view, with a fake clock. FR-NOTIFY-01-12: `start()` calls `Tick` at once and then every 30 seconds, so the delay after the batching period is at most 30 seconds; `stop()` ends the loop at its next wake and a later `start()` runs a new loop. FR-NOTIFY-01-14: the scheduler takes no settings: the period is fixed. A `Tick` that is still running delays the next call instead of overlapping, and a `Tick` that throws is logged to standard error and the loop goes on.

## Build
```ts
export class NoticeScheduler { constructor(d: { tick: Tick; clock: Clock; log(line: string): void }); start(): void; stop(): void }
export const TICK_MS = 30_000;
```

## Done when
`bun test test/notify/unit/notice-scheduler.test.ts`

## Out of scope
The wiring into the lease hooks (SPEC-01-8).

## Open questions
None.
