# SPEC-12: a send uses the owner's go in one unit of work and tells the owner when the window is closed

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Checks the customer window first: a closed window creates nothing, sends nothing, returns `window_closed` and leaves the go in place, so the owner is told (SPEC-06 applies here too). Otherwise, in one unit of work, it takes the pending go and approves the draft with `Draft.approveWithoutWords("owner_go", ownerWords)` (SPEC-09-4), so the go is consumed only when its approval exists. The send then runs the existing `driveSend` with the approval, which resumes by its send id on recovery. The approval's send id is the go's `send_id` in `pending_goes`. This is the R-DRAFTS-19 exception for an owner answer (R-DRAFTS-23, ADR-013). Input: `{ chatId, text }`; the text is the session's, and Drafts trusts it (D11).

Last change: 2026-11-24, after the review of 7a56758: the go is one unit of work with its approval; closed window tells the owner; the always-ask list comes from Knowledge; reconcile on start; the basis is in the log read; pilotStatsTool is in the application layer.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/owner-go-send.ts | Create | `sendWithOwnerGo`: the window check, the unit of work, and driveSend |
| test/drafts/owner-go-send.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-09-4-draft-without-words.md, the `approveWithoutWords` method this spec calls for the owner_go basis.
- Precedent: SPEC-06-first-send-window.md, the window check this spec calls first.
- Precedent: SPEC-03-safe-send.md, whose `driveSend` runs the send and its recovery unchanged.
- Dependency: SPEC-10-3-pending-goes-in-transaction.md, which puts `pendingGoes` in the transaction this spec runs in.

## Tests first
- FR-DRAFTS-02-14 (7): given a taken go for chat "c1" and an open window, the draft is approved with basis `owner_go`, sent through driveSend, and `pending_goes.send_id` equals the approval's send id.
- FR-DRAFTS-02-14 (8): given no go for the chat, nothing is created or sent (R-DRAFTS-2 still holds).
- FR-DRAFTS-02-14 (9): a go taken for chat "c1" is never used for a send to chat "c2".
- FR-DRAFTS-02-14 (10): given the approval write failing after the go was taken, the unit of work rolls back, so the go's `used_at` is null afterwards.
- FR-DRAFTS-02-14 (11): given a closed customer window, nothing is created or sent, the result is `window_closed`, and the go stays stored.

## Build
```ts
export async function sendWithOwnerGo(input: { chatId: string; text: string }, d: { uow: UnitOfWork; latestCustomerSentAt: number | null; now: number; newSendId: () => string; createDraft: (chatId: string, text: string) => Promise<DraftRef>; driveSend: (approval: Approval) => Promise<"sent" | "refused">; windowCheck: (latest: number | null, now: number) => FirstSendCheck }): Promise<"sent" | "refused" | "window_closed">;
```
The window check comes first and returns `window_closed` with `tellOwner: true` when the window is closed. The go is taken and the approval written in one `uow.run`; the send runs after that commit.

## Done when
`bun test test/drafts/owner-go-send.test.ts`

## Out of scope
The go's logic (SPEC-07), the store (SPEC-10-2), the Draft method (SPEC-09-4), the basis column (SPEC-09-5a, 09-5b), and the tools (SPEC-13).

## Open questions
None.
