# SPEC-12: a send uses the owner's go and logs it without a draft number

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

The send path takes the pending go for a chat (SPEC-07 `takeGo`) and, when one is taken, sends and logs the approval with the chat and the owner's words and no draft number. This is the R-DRAFTS-19 exception for an owner answer (R-DRAFTS-23, ADR-013). With no go, the send is refused as before.

Last change: 2026-11-24, split and extended after the review of PR 202 (pending go async; optional automatic; wiring and send-path specs added).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/owner-go-send.ts | Create | The send with an owner go: takes the go, sends, and logs the approval |
| src/drafts/ports/store.ts | Change | The approval repository gets `appendOwnerGo(chatId, questionId, ownerWords, at)`, which stores no draft number |
| test/drafts/owner-go-send.test.ts | Create | The tests for FR-DRAFTS-02-14, send part |

## Reuses
- Precedent: SPEC-03-safe-send.md, whose send path this spec calls for the one send the go covers.
- Precedent: SPEC-02-owners-go.md, which records the approval with the owner's words (ADR-003).

## Tests first
- FR-DRAFTS-02-14 (7): given a taken go for chat "c1", the send is made and the approval logged with `owner_words` = the text and no draft number.
- FR-DRAFTS-02-14 (8): given no go for the chat, the send is refused and nothing is logged as an owner approval (R-DRAFTS-2 still holds).
- FR-DRAFTS-02-14 (9): a go taken for chat "c1" is never used for a send to chat "c2".

## Build
```ts
export async function sendWithOwnerGo(chatId: string, text: string, d: { store: PendingGoStore; approvals: { appendOwnerGo(chatId: string, questionId: string, ownerWords: string, at: number): Promise<void> }; send: (chatId: string, text: string) => Promise<void>; latestCustomerSentAt: number | null; now: number }): Promise<"sent" | "refused">;
```

## Done when
`bun test test/drafts/owner-go-send.test.ts`

## Out of scope
The go's logic (SPEC-07), the store (SPEC-10-2), and the draft-number path that every other send uses (SPEC-02, SPEC-03).

## Open questions
None.
