# SPEC-01-2: The pending counts and the handler of the stored-messages hint

Status: Draft
Rests on: ../frd/FRD-01-batched-notice.md

## Summary

An in-memory `NoticeSession` that holds the pending counts per chat and when the batching period started, and `OnMessagesStored`, which adds the customer items of Intake's `MessageStored` hint to it. A message the owner sent from the app never counts. A new lease starts a new empty session.

Last change: 2026-11-24, first draft for the local pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-NOTIFY-01-1 | WHEN | When new customer messages are stored while Deputy runs and a session that supports push is open, Deputy shall send that session one notice that summarizes them. It uses the "message stored" signal from Intake. By default new messages reach Deputy through the periodic catch-up while the session is open (default every 2 minutes, set by the owner in Intake), so a message can show up in a notice up to one catch-up period after the customer wrote it. If the owner turned on live delivery from the provider (an optional advanced setting), messages are stored at once, and periodic catch-up still runs as a safety net. Notify does not care which path stored a message. (R-NOTIFY-1) |
| FR-NOTIFY-01-2 | always | Messages that arrive close together produce one notice. Within one batching period, at most one notice shall be sent. The first new message stored (not the time the customer wrote it) starts the period, and the notice shall go out when the period ends. The default period is 10 minutes. If the session closes before the period ends, no notice is sent and the messages stay in the inbox. If a quiet period is running when the period ends, the notice waits for the end of the quiet period. (R-NOTIFY-2) |
| FR-NOTIFY-01-8 | always | The messages that catch-up finds at session start shall produce one notice, not one per message. The same shall hold for each periodic catch-up: all messages one catch-up stores, together with others in the same batching period, make one notice. A batching period shorter than the catch-up period shall give at most one notice per catch-up that found something. (R-NOTIFY-13) |
| FR-NOTIFY-01-11 | IF | Only messages from customers shall count as new. Messages whose source is "owner from the app" or "sent through Deputy" shall never count. Stored dev test messages never count once the provider is not dev (FR-INTAKE-01-10). Deputy shall compute every count at the moment the notice is sent. A chat the owner answered by then shall be left out of both the new and the waiting counts. If nothing is left to count, no notice shall be sent. (R-NOTIFY-3) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/notify/domain/notice-session.ts` | Create | `NoticeSession` |
| `src/notify/application/on-messages-stored.ts` | Create | `OnMessagesStored`, `MessagesStoredHint` |
| `test/notify/unit/on-messages-stored.test.ts` | Create | the tests below |

## Reuses
- `src/intake/domain/events.ts` `MessageStored`: the hint shape (chat, source, count, at) the handler accepts; Notify imports it only through `src/intake/index.ts`
- `src/shared/owner-lease.ts` `OwnerLease`: the handler asks it before it writes

## Tests first
FR-NOTIFY-01-1, FR-NOTIFY-01-2, FR-NOTIFY-01-8, FR-NOTIFY-01-11, written before the code, without it in view, with a fake lease and a fake clock. FR-NOTIFY-01-1: a hint of five customer messages in three chats, from catch-up or live delivery, gives pending counts of five messages and three chats, the same either way; two hints for the same chat add. FR-NOTIFY-01-11: items with source `owner_app` add nothing. FR-NOTIFY-01-2: the first stored hint sets `batchStartedAt` to the hint's `at`, not to the time the customers wrote, and later hints in the same period do not move it. FR-NOTIFY-01-8: three catch-ups in one period make one pending set. FR-NOTIFY-01-11: a hint with no customer item changes nothing; a process that does not hold the lease changes nothing; starting a new session empties the counts.

## Build
```ts
export interface MessagesStoredHint { origin: "live" | "catch_up"; items: ReadonlyArray<{ chat: ChatId; source: "customer" | "owner_app"; count: number }>; at: Instant }
export class NoticeSession {
  add(items: MessagesStoredHint["items"], at: Instant): void;      // customer items only; sets batchStartedAt when empty
  take(): { counts: ReadonlyMap<ChatId, number>; startedAt: Instant } | null; // moves the pending set out
  putBack(b: { counts: ReadonlyMap<ChatId, number>; startedAt: Instant }): void; // merges, keeps the older start
  readonly batchStartedAt: Instant | null;
}
export class OnMessagesStored { execute(h: MessagesStoredHint): Promise<void> } // never throws
```
A chat id lives only in memory and is never written to a notice or a table.

## Done when
`bun test test/notify/unit/on-messages-stored.test.ts`

## Out of scope
Due times and sending (SPEC-01-3); the event subscription (SPEC-01-7).

## Open questions
None.
