# SPEC-01-8: The notices start and stop with the lease

Status: Draft
Rests on: ../frd/FRD-01-batched-notice.md

## Summary

On every lease acquisition a new notice session starts and the notice scheduler runs; when the lease is lost the scheduler stops. This is the last step: after it a customer message stored by catch-up produces one notice.

Last change: 2026-11-24, first draft for the local pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-NOTIFY-01-1 | WHEN | When new customer messages are stored while Deputy runs and a session that supports push is open, Deputy sends that session one notice that summarizes them. It uses the "message stored" signal from Intake. By default new messages reach Deputy through the periodic catch-up while the session is open (default every 2 minutes, set by the owner in Intake), so a message can show up in a notice up to one catch-up period after the customer wrote it. If the owner turned on live delivery from the provider (an optional advanced setting), messages are stored at once, and periodic catch-up still runs as a safety net. Notify does not care which path stored a message. (R-NOTIFY-1) |
| FR-NOTIFY-01-2 | always | Messages that arrive close together produce one notice. Within one batching period, at most one notice is sent. The first new message stored (not the time the customer wrote it) starts the period, and the notice goes out when the period ends. The default period is 10 minutes. If the session closes before the period ends, no notice is sent and the messages stay in the inbox. If a quiet period is running when the period ends, the notice waits for the end of the quiet period. (R-NOTIFY-2) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/serve.ts` | Change | builds Notify after Intake and the server |
| `src/main/lifecycle.ts` | Change | starts and stops Notify with the lease |
| `test/notify/unit/notify-lifecycle.test.ts` | Create | the tests below |

## Reuses
- `src/main/lifecycle.ts` `superviseLease`: where the lease hooks are
- `src/main/serve.ts` `serve`: the start order
- Precedent: SPEC-01-7-notify-composition.md, `createNotify`

## Tests first
FR-NOTIFY-01-1, FR-NOTIFY-01-2, written before the code, without it in view, with a fake lease supervisor. FR-NOTIFY-01-1: when the lease is acquired `startSession()` and `start()` run once each, in that order. FR-NOTIFY-01-2: when the lease is lost `stop()` runs and the pending counts are not used by a later owner; a second acquisition starts a new empty session. An end-to-end run with a fake provider that stores two customer messages in one catch-up and a fake channel client that declares the capability gets one notice after the period.

## Build
`serve.ts` builds `createNotify` after the intake runtime and the MCP server exist (it needs both) and passes its three functions to `superviseLease` as `notify`. `lifecycle.ts` calls `notify.startSession(); notify.start()` in `onAcquired` and `notify.stop()` in `onLost`.

## Done when
`bun test test/notify/unit/notify-lifecycle.test.ts`

## Out of scope
Nothing else: the notice is the last step of the pilot's wake design (ADR-018); the loop fallback is the skill's.

## Open questions
None.
