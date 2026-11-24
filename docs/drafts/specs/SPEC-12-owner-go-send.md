# SPEC-12: a send uses the owner's go through the normal approval path

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Takes the pending go for a chat (SPEC-07 `takeGo`), creates a draft from the session's text, approves it with `Draft.approveWithoutWords("owner_go", ownerWords)` (SPEC-09-4), and runs the existing send use case (`driveSend`). The approval's send id is written to `pending_goes.send_id` by `takeGo`. This is the R-DRAFTS-19 exception for an owner answer (R-DRAFTS-23, ADR-013). With no go for the chat, nothing is created or sent. Input: `{ chatId, text }`; the text is the session's and Drafts trusts it (D11).

Last change: 2026-11-24, after the lead's decision: approveWithoutWords replaces sendWithoutWords and the approval records its basis.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/owner-go-send.ts | Create | `sendWithOwnerGo`: take the go, create the draft, approve it with the owner_go basis, run driveSend |
| test/drafts/owner-go-send.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-09-4-draft-without-words.md, the `approveWithoutWords` method this spec calls for the owner_go basis.
- Precedent: SPEC-03-safe-send.md, whose `driveSend` runs the send unchanged.

## Tests first
- FR-DRAFTS-02-14 (7): given a taken go for chat "c1", the draft is approved with basis `owner_go`, sent through driveSend, and `pending_goes.send_id` equals the approval's send id.
- FR-DRAFTS-02-14 (8): given no go for the chat, nothing is created or sent (R-DRAFTS-2 still holds).
- FR-DRAFTS-02-14 (9): a go taken for chat "c1" is never used for a send to chat "c2".

## Build
```ts
export async function sendWithOwnerGo(input: { chatId: string; text: string }, d: { store: PendingGoStore; createDraft: (chatId: string, text: string) => Promise<DraftRef>; approveAndSend: (draft: DraftRef, basis: "owner_go", words: string, sendId: string) => Promise<"sent" | "refused">; latestCustomerSentAt: number | null; now: number; newSendId: () => string }): Promise<"sent" | "refused">;
```

## Done when
`bun test test/drafts/owner-go-send.test.ts`

## Out of scope
The go's logic (SPEC-07), the store (SPEC-10-2), the Draft method (SPEC-09-4), the basis column (SPEC-09-5a, 09-5b), and the tools (SPEC-13).

## Open questions
None.
