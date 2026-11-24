# SPEC-11: Drafts records an owner answer as a go

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Drafts subscribes to Intake's OwnerAnswered signal at start and calls `recordGo` for each answer, so the pending go exists before the next send (R-DRAFTS-23). OwnerAnswered is published by Intake's SPEC-05-12 in `src/shared/signals.ts`; the subscription is registered in composition.

Last change: 2026-11-24, split and extended after the review of PR 202 (pending go async; optional automatic; wiring and send-path specs added).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/on-owner-answered.ts | Create | The handler: calls `recordGo` for one OwnerAnswered and logs a failure without throwing |
| src/main/drafts.ts | Change | Subscribes the handler to OwnerAnswered once, after the pending-go store is built |
| test/drafts/on-owner-answered.test.ts | Create | The tests for FR-DRAFTS-02-14, wiring part |

## Reuses
- Precedent: SPEC-03-safe-send.md, which subscribes to `SendNeedsOwner` in composition the same way.

## Tests first
- FR-DRAFTS-02-14 (5): given an OwnerAnswered signal, `recordGo` is called once with its questionId, chatId, text and at.
- FR-DRAFTS-02-14 (6): given the wiring runs twice, the subscription is registered once.
- FR-DRAFTS-02-14 (7): given a store that throws, the handler logs the failure and does not throw into the bus.

## Build
```ts
export function onOwnerAnswered(store: PendingGoStore): (signal: OwnerAnswered) => Promise<void>;
```

## Done when
`bun test test/drafts/on-owner-answered.test.ts`

## Out of scope
The store (SPEC-10-2), the go logic (SPEC-07), and the send (SPEC-12).

## Open questions
None.
