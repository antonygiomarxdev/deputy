# SPEC-01-7: The composition builds Notify and subscribes it to Intake

Status: Draft
Rests on: ../frd/FRD-01-batched-notice.md

## Summary

One file in the composition root builds `OnMessagesStored`, `Tick`, the readers, the notifier and the scheduler, and subscribes the handler to Intake's event bus. Intake's runtime now exposes that bus.

Last change: 2026-11-24, first draft for the local pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-NOTIFY-01-1 | WHEN | When new customer messages are stored while Deputy runs and a session that supports push is open, Deputy shall send that session one notice that summarizes them. It uses the "message stored" signal from Intake. By default new messages reach Deputy through the periodic catch-up while the session is open (default every 2 minutes, set by the owner in Intake), so a message can show up in a notice up to one catch-up period after the customer wrote it. If the owner turned on live delivery from the provider (an optional advanced setting), messages are stored at once, and periodic catch-up still runs as a safety net. Notify does not care which path stored a message. (R-NOTIFY-1) |
| FR-NOTIFY-01-13 | always | In the local pilot (REQ-15), Deputy shall take the waiting chats from Intake's pending list (FR-INTAKE-05-13) in place of Inbox, and leaves out the ignored-chat filter because the pilot has no ignore list. (REQ-15, D34) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/intake.ts` | Change | returns `events` with the runtime |
| `src/main/notify.ts` | Create | `createNotify` |
| `test/notify/unit/notify-composition.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/events/in-process-event-bus.ts` `InProcessEventBus`: the bus Intake publishes on; `subscribe` registers the handler
- `src/main/intake.ts` `createIntakeRuntime`: where the bus is made today and not returned
- Precedent: SPEC-01-6-notice-scheduler.md, the scheduler this file builds

## Tests first
FR-NOTIFY-01-1, FR-NOTIFY-01-13, written before the code, without it in view, with fake ports and an `InProcessEventBus`. FR-NOTIFY-01-1: a `MessageStored` event published on the bus reaches `OnMessagesStored` and adds to the session; events of the other kinds are ignored. FR-NOTIFY-01-13: the waiting source built is the Intake pending list, not an Inbox port. The returned `start()` and `stop()` start and stop the scheduler and `startSession()` empties the counts.

## Build
```ts
export function createNotify(d: { events: InProcessEventBus<IntakeEvent>; intake: Pick<IntakeRuntime, "listPending" | "getSyncStatus">; server: ChannelServer; lease: OwnerLease; clock: Clock }): { startSession(): void; start(): void; stop(): void };
```
`main/intake.ts` returns `{ ...runtime, events }`. `createNotify` builds the notifier with `enabled: true`, a constant for the pilot (FR-NOTIFY-01-14).

## Done when
`bun test test/notify/unit/notify-composition.test.ts`

## Out of scope
Calling the three functions on lease changes (SPEC-01-8).

## Open questions
None.
