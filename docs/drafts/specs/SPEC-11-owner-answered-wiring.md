# SPEC-11: Drafts records owner answers as goes, live and on start

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Drafts subscribes to Intake's OwnerAnswered signal and calls `recordGo` for each answer (live). On start it also reconciles: it reads Intake's answered questions and records the ones missing from `pending_goes`, idempotent by question id, because the signal is in-process and an answer given while Drafts was stopped would otherwise be lost (R-DRAFTS-23). The composition root (src/main/drafts.ts) also builds the Knowledge always-ask adapter (SPEC-14) and passes it to the send_answer tool (SPEC-13).

Last change: 2026-11-24, after the review of 7a56758: the go is one unit of work with its approval; closed window tells the owner; the always-ask list comes from Knowledge; reconcile on start; the basis is in the log read; pilotStatsTool is in the application layer.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/on-owner-answered.ts | Create | The live handler and `reconcileOwnerAnswers` |
| src/main/drafts.ts | Change | Subscribes the handler once, and runs the reconcile after the pending-go store is built, before the first poll |
| test/drafts/on-owner-answered.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-03-safe-send.md, which subscribes to `SendNeedsOwner` in composition the same way.
- Dependency: Intake PR 212 exports `listAnsweredQuestions()` over `owner_questions` (answered rows, FR-INTAKE-05-9), returning `{ questionId, chatId, text, at }` with `chatId` a ChatId and `at` an Instant, Intake's types. Merge order: PR 209 and PR 212 before PR 202.

## Tests first
- FR-DRAFTS-02-14 (5): given an OwnerAnswered signal, `recordGo` is called once with its questionId, chatId, text and at.
- FR-DRAFTS-02-14 (6): given the wiring runs twice, the subscription is registered once.
- FR-DRAFTS-02-14 (7): given a store that throws, the handler logs the failure and does not throw into the bus.
- FR-DRAFTS-02-14 (8): given an answered question in Intake that is not in `pending_goes`, `reconcileOwnerAnswers` records it.
- FR-DRAFTS-02-14 (9): running `reconcileOwnerAnswers` twice records each question once.

## Build
```ts
export function onOwnerAnswered(store: PendingGoStore): (signal: OwnerAnswered) => Promise<void>;
export async function reconcileOwnerAnswers(port: { listAnsweredQuestions(): Promise<OwnerAnswer[]> }, store: PendingGoStore): Promise<number>;  // store.put is idempotent by questionId (SPEC-10-2)
```

## Done when
`bun test test/drafts/on-owner-answered.test.ts`

## Out of scope
The store (SPEC-10-2), the go's logic (SPEC-07), the send (SPEC-12), and Intake's export (its follow-up).

## Open questions
None.
