# SPEC-12: a send uses the owner's go and records it in pending_goes

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

The send path takes the pending go for a chat (SPEC-07 `takeGo`) and, when one is taken, sends with the go's send id, so `pending_goes` records the use (`used_at`, `send_id`). The go is not written to approvals or the drafts log. This is the R-DRAFTS-19 exception for an owner answer (R-DRAFTS-23, ADR-013). With no go, the send is refused as before.

Last change: 2026-11-24, after the lead's decision: the owner's go is recorded in pending_goes, not in approvals or the drafts log.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/owner-go-send.ts | Create | The send with an owner go: takes the go, sends with its send id |
| test/drafts/owner-go-send.test.ts | Create | The tests for FR-DRAFTS-02-14, send part |

## Reuses
- Precedent: SPEC-03-safe-send.md, whose send path this spec calls for the one send the go covers.
- Precedent: SPEC-10-2-pending-go-store.md, which records the use (`used_at`, `send_id`).

## Tests first
- FR-DRAFTS-02-14 (7): given a taken go for chat "c1", the send is made with the go's send id, and `pending_goes` holds `used_at` and `send_id` for that go; no approval or drafts-log row is written for it.
- FR-DRAFTS-02-14 (8): given no go for the chat, the send is refused (R-DRAFTS-2 still holds).
- FR-DRAFTS-02-14 (9): a go taken for chat "c1" is never used for a send to chat "c2".

## Build
```ts
export async function sendWithOwnerGo(chatId: string, text: string, d: { store: PendingGoStore; send: (chatId: string, text: string, sendId: string) => Promise<void>; latestCustomerSentAt: number | null; now: number; newSendId: () => string }): Promise<"sent" | "refused">;
```

## Done when
`bun test test/drafts/owner-go-send.test.ts`

## Out of scope
The go's logic (SPEC-07), the store (SPEC-10-2), and the draft-number path that every other send uses (SPEC-02, SPEC-03).

## Open questions
None.
