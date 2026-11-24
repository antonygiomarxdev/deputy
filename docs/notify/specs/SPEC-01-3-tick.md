# SPEC-01-3: Tick: send one batched notice when the period has ended

Status: Draft
Rests on: ../frd/FRD-01-batched-notice.md

## Summary

The use case `Tick` runs often and does nothing unless the batching period has ended. Then it takes the pending counts, keeps the chats that are still waiting, builds the counts, delivers one notice and, when delivery fails, keeps the batch and tries again after 60 seconds (ADR-006). It holds the three outbound ports it needs.

Last change: 2026-11-24, first draft for the local pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-NOTIFY-01-2 | always | Messages that arrive close together produce one notice. Within one batching period, at most one notice is sent. The first new message stored (not the time the customer wrote it) starts the period, and the notice goes out when the period ends. The default period is 10 minutes. If the session closes before the period ends, no notice is sent and the messages stay in the inbox. If a quiet period is running when the period ends, the notice waits for the end of the quiet period. (R-NOTIFY-2) |
| FR-NOTIFY-01-4 | always | Deputy takes the count of waiting chats from Inbox. A chat the owner already answered is not in it. If Intake's catch-up status is "failed", the notice adds that the waiting count may be incomplete. (R-NOTIFY-3, R-NOTIFY-14) |
| FR-NOTIFY-01-7 | always | A message is counted as new in one delivered notice only (a notice that failed to deliver does not count, see FRD-03). In a later notice it can appear only as part of a chat still waiting. (R-NOTIFY-12) |
| FR-NOTIFY-01-9 | always | Chats still unanswered keep appearing, as a count, in later notices. Deputy counts them itself, so the notice does not depend on the agent remembering them. (R-NOTIFY-14) |
| FR-NOTIFY-01-11 | IF | Only messages from customers count as new. Messages whose source is "owner from the app" or "sent through Deputy" never count. Stored dev test messages never count once the provider is not dev (FR-INTAKE-01-10). Deputy computes every count at the moment the notice is sent. A chat the owner answered by then is left out of both the new and the waiting counts. If nothing is left to count, no notice is sent. (R-NOTIFY-3) |
| FR-NOTIFY-01-12 | always | The worst-case delay between a customer writing and the notice that counts the message is one catch-up period plus the batching period (with the defaults, 2 plus 10 minutes), when live delivery is off. Quiet periods can add to it. (R-NOTIFY-2) |
| FR-NOTIFY-01-15 | WHEN | When a notice cannot be delivered, because no session is open or writing returns an error, Deputy keeps the batch and tries again after 60 seconds, and the next notice counts those messages as new. With no open session nothing is sent and the inbox keeps listing the messages. (FR-NOTIFY-03-4, FR-NOTIFY-03-6, FR-NOTIFY-03-7, ADR-006) |
| FR-NOTIFY-01-17 | IF | If reading the waiting chats fails when a notice is due, Deputy treats the notice as failed: it keeps the batch and tries again as FR-NOTIFY-01-15 says, and sends no notice with a caveat. (lead decision, 2026-11-24) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/notify/ports/notice-ports.ts` | Create | `WaitingCounts`, `SyncStatusReader`, `Notifier` |
| `src/notify/application/tick.ts` | Create | `Tick` and `TickResult` |
| `test/notify/unit/tick.test.ts` | Create | the tests below |

## Reuses
- Precedent: SPEC-01-1-notice-value-and-text.md, `Notice` and `toEnvelope`
- Precedent: SPEC-01-2-session-and-stored-hint.md, `NoticeSession`
- `src/shared/clock.ts` `Clock`: the time Tick reads
- `src/shared/owner-lease.ts` `OwnerLease`: Tick does nothing without it

## Tests first
FR-NOTIFY-01-2, FR-NOTIFY-01-4, FR-NOTIFY-01-7, FR-NOTIFY-01-9, FR-NOTIFY-01-11, FR-NOTIFY-01-12, FR-NOTIFY-01-15, FR-NOTIFY-01-17, written before the code, without it in view, with fake ports and a fake clock. FR-NOTIFY-01-2: with the period started at minute 0, `Tick` sends nothing at minute 9 and one notice at minute 10 (the default of 10 minutes); a second `Tick` in the same period sends nothing. FR-NOTIFY-01-11: the notice keeps only the batch chats that the waiting snapshot lists; `messages` is their summed count, `chats` their number and `otherWaiting` the snapshot minus them; with none left nothing is sent and the batch is dropped. FR-NOTIFY-01-4: a sync status `failed` adds the caveat `waiting_may_be_incomplete`. FR-NOTIFY-01-7: after a delivered notice the same messages are not new again. FR-NOTIFY-01-9: a chat that is still waiting and has no new message is counted in `otherWaiting` of a later notice. FR-NOTIFY-01-12: a message stored at minute 0 of a period is counted by the notice at minute 10 and not later. FR-NOTIFY-01-17: a waiting read that throws is a failed delivery, so no notice is sent, the batch is put back and no tick retries it before 60 seconds. FR-NOTIFY-01-15: availability other than `ready` sends nothing and drops the pending counts, and a process without the lease does nothing; a delivery that returns `no_session` or `write_error` is a failed notice and nothing throws; after a failed delivery the batch is put back, no tick before 60 seconds retries it, and the next notice counts those messages as new.

## Build
```ts
export interface WaitingCounts { snapshot(): Promise<{ chats: ReadonlyArray<ChatId> }> } // throws when the read fails
export interface SyncStatusReader { read(): Promise<{ status: "complete" | "failed" }> }
export interface Notifier { availability(): "off" | "ready"; deliver(e: NoticeEnvelope): Promise<{ kind: "delivered" } | { kind: "failed"; reason: "no_session" | "write_error" }> }
export type TickResult = { kind: "skipped" } | { kind: "idle" } | { kind: "nothing_due" } | { kind: "retrying" } | { kind: "sent" } | { kind: "failed"; reason: "no_session" | "write_error" };
export class Tick { execute(): Promise<TickResult> }
```
Order: lease; availability; retry gate; due check (`batchStartedAt` plus 10 minutes); take the batch; read waiting and status; build; deliver; settle. A throw from the waiting read is a failed delivery (FR-NOTIFY-01-17).

## Done when
`bun test test/notify/unit/tick.test.ts`

## Out of scope
Reminders, quiet periods, owner settings and outage notices (deferred, FR-NOTIFY-01-14); the durable notice state and its status line (deferred); the adapters (SPEC-01-4, SPEC-01-5).

## Open questions
None. The question of what a failed read of the waiting chats means was answered as L13 in docs/DECISIONS.md: it is a failed delivery, the batch is kept and retried.
