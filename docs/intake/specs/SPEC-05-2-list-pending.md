# SPEC-05-2: The pending list with each customer window

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

A read use case `ListPending`: the chats whose latest customer message is newer than their latest answer, inside the pending window, newest first, each with the time its customer 24 hour window closes. The control chat is never listed. No text, no groups, no ignore list. A subset of Inbox FR-INBOX-01.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-12 | always | Each customer chat shall show when its customer 24 hour window closes: 24 hours after the customer's latest message. |
| FR-INTAKE-05-13 | WHEN | When the session asks for the pending chats, Intake shall list each chat whose latest customer message is newer than its latest answer, inside the pending window of FR-INBOX-01-6, newest first, each with the time its customer window closes. The control chat shall never be listed. |
| FR-INTAKE-05-14 | always | The pending list shall hold no summary groups, no ignore list and no message text. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/list-pending.ts` | Create | the `ListPending` port and `PendingChat` |
| `src/intake/application/list-pending.ts` | Create | `ListPendingUseCase` |
| `test/intake/unit/list-pending.test.ts` | Create | the tests below |

## Reuses
- `src/intake/application/list-chats.ts` `ListChatsUseCase`: returns every chat's state with `lastCustomerAt` and `lastAnswerAt`
- `src/intake/ports/views.ts` `ChatStateView`: the fields the list is built from
- `src/intake/domain/owner-numbers.ts` `OwnerNumbers`: `isControlChat` (SPEC-05-1) keeps the control chat out
- `src/shared/clock.ts` `Clock`: the time the pending window is counted back from

## Tests first
FR-INTAKE-05-12, FR-INTAKE-05-13, FR-INTAKE-05-14, written before the code, without them in view. FR-INTAKE-05-12: a customer chat with its latest message at time T has `windowClosesAt` T plus 24 hours. FR-INTAKE-05-13: a chat whose latest customer message is newer than its latest answer is listed; one answered later is not; one older than the pending window days is not; the order is newest first; the control chat is never listed even with a newer message. FR-INTAKE-05-14: an item holds the chat, `lastCustomerAt` and `windowClosesAt` only, no text and no group field.

## Build
```ts
export interface PendingChat { chat: ChatId; lastCustomerAt: Instant; windowClosesAt: Instant }
export interface ListPending { execute(q: { windowDays: number }): Promise<PendingChat[]> }
export const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;
```
`windowClosesAt` is `lastCustomerAt + CUSTOMER_WINDOW_MS`. The list keeps a state when `lastCustomerAt` is later than `lastAnswerAt` (or there is no answer) and `lastCustomerAt` is within `windowDays` of `clock.now()`.

## Done when
`bun test test/intake/unit/list-pending.test.ts`

## Out of scope
The tool that returns it (SPEC-05-3). Summary groups and the ignore list (Inbox, deferred). The `windowDays` setting is Inbox's `pending_window_days`; this use case takes it as an argument.

## Open questions
None.
