# SPEC-07: the owner's answer is the go for the next send to its chat

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Records an owner's answer to an `ask_owner` question as the go for the next send to the customer chat the question names (R-DRAFTS-23). Intake's OwnerAnswered carries `questionId`, `chatId`, `text` and `at`; the `chatId` is FR-INTAKE-05-25 (Intake PR #206, pending). The go is taken once, only within the customer window, and approves no other draft. The pending go is kept by SPEC-10.

Last change: 2026-11-24, Q-2 closed by SPEC-10 (the pending go is stored in SQLite).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/owner-answer.ts | Create | The owner's answer: questionId, chatId, text and time, the fields of Intake's OwnerAnswered |
| src/drafts/domain/ask-owner-go.ts | Create | recordGo and takeGo over the PendingGoStore port |
| test/drafts/ask-owner-go.test.ts | Create | The tests for FR-DRAFTS-02-14 |

## Reuses
- Precedent: SPEC-03-safe-send.md, which creates `CUSTOMER_WINDOW_MS`; this spec uses that constant for the window and does not redefine it.
- Precedent: SPEC-02-owners-go.md, which records an owner's go with the owner's words (ADR-003); the go taken here is logged the same way when a send uses it.

## Tests first
- FR-DRAFTS-02-14 (1): given an answer for chat "c1" with text "yes", `recordGo` stores it, and `takeGo("c1")` within the window returns `{ questionId, ownerWords: "yes" }`.
- FR-DRAFTS-02-14 (2): given no stored go for a chat, `takeGo` returns null and writes nothing.
- FR-DRAFTS-02-14 (3): given a go already taken, a second `takeGo` for that chat returns null: the go covers one send.
- FR-DRAFTS-02-14 (4): given the customer window closed (latest customer message more than `CUSTOMER_WINDOW_MS` ago), `takeGo` returns null and leaves the stored go in place.

## Build
```ts
export type OwnerAnswer = { questionId: string; chatId: string; text: string; at: number };
export type PendingGo = { questionId: string; chatId: string; ownerWords: string; at: number };
export interface PendingGoStore { put(go: PendingGo): void; take(chatId: string, now: number): PendingGo | null; }
export function recordGo(answer: OwnerAnswer, store: PendingGoStore): void;
export function takeGo(chatId: string, store: PendingGoStore, latestCustomerSentAt: number | null, now: number): PendingGo | null;
```
`takeGo` returns null without touching the store when there is no customer message or the window has closed. The caller (the send path) logs a taken go as an approval with `owner_words` = `ownerWords` (ADR-003).

## Done when
`bun test test/drafts/ask-owner-go.test.ts`

## Out of scope
The question batching and the numbered WhatsApp message (Intake), the `chatId` on the question and on OwnerAnswered (FR-INTAKE-05-25, Intake PR #206, pending), the answer_question tool's registration (Intake), the durable store (SPEC-10), and the approval entry written at send time (the send path). Deputy never guesses a question from a free reply.

## Open questions
None. The pending-go question is closed by SPEC-10.
