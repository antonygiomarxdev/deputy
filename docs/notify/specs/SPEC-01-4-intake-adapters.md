# SPEC-01-4: The waiting chats and the sync status come from Intake

Status: Draft
Rests on: ../frd/FRD-01-batched-notice.md

## Summary

Two small adapters that answer Notify's ports from Intake's published ports: `WaitingCounts` from the pending list (FR-INTAKE-05-13) and `SyncStatusReader` from `GetSyncStatus`. Notify reads no Intake table and no message text.

Last change: 2026-11-24, first draft for the local pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-NOTIFY-01-4 | always | Deputy shall take the count of waiting chats from Inbox. A chat the owner already answered shall not be in it. If Intake's catch-up status is "failed", the notice shall add that the waiting count may be incomplete. (R-NOTIFY-3, R-NOTIFY-14) |
| FR-NOTIFY-01-13 | always | In the local pilot (REQ-15), Deputy shall take the waiting chats from Intake's pending list (FR-INTAKE-05-13) in place of Inbox, and leaves out the ignored-chat filter because the pilot has no ignore list. (REQ-15, D34) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/notify/adapters/intake/intake-readers.ts` | Create | `IntakeWaitingCounts`, `IntakeSyncStatusReader` |
| `test/notify/unit/intake-readers.test.ts` | Create | the tests below |

## Reuses
- `src/intake/index.ts` `GetSyncStatus`: the published status read
- Precedent: docs/intake/specs/SPEC-05-2-list-pending.md, the pending list `ListPending` this adapter calls through the Intake index
- Precedent: SPEC-01-3-tick.md, the two ports these adapters implement

## Tests first
FR-NOTIFY-01-4, FR-NOTIFY-01-13, written before the code, without it in view, with fake Intake ports. FR-NOTIFY-01-13: `snapshot()` returns the chat ids of the pending list and nothing else, in the list's order; an empty list gives an empty snapshot; an error from the pending list is thrown to the caller. FR-NOTIFY-01-4: `read()` returns `failed` when `GetSyncStatus` says `failed` and `complete` otherwise, and carries no other field.

## Build
```ts
export class IntakeWaitingCounts implements WaitingCounts { constructor(d: { listPending: ListPending }) }
export class IntakeSyncStatusReader implements SyncStatusReader { constructor(d: { getSyncStatus: GetSyncStatus }) }
```
`ListPending` is Intake's published read of SPEC-05-2; it needs no lease.

## Done when
`bun test test/notify/unit/intake-readers.test.ts`

## Out of scope
Any Inbox read (Inbox is not in the pilot).

## Open questions
None.
