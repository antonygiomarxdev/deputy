# SPEC-12: a send uses the owner's go and goes through the Draft

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

The send path takes the pending go for a chat (SPEC-07 `takeGo`), creates a draft from the session's text, and sends it with `Draft.sendWithoutWords("owner_go")` (SPEC-09-4), so the log records the send as a normal `DraftSent` with `automatic` false. The send's id is the go's `send_id` in `pending_goes`. This is the R-DRAFTS-19 exception for an owner answer (R-DRAFTS-23, ADR-013). With no go for the chat, the send is refused. Input: `{ chatId, text }`. The text is the session's; Drafts trusts it, as D11 states for an agent with its own tools.

Last change: 2026-11-24, the send goes through the Draft aggregate (SPEC-09-4).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/owner-go-send.ts | Create | `sendWithOwnerGo`: takes the go, creates the draft, sends it with the owner_go basis |
| test/drafts/owner-go-send.test.ts | Create | The tests for FR-DRAFTS-02-14, send part |

## Reuses
- Precedent: SPEC-09-4-draft-without-words.md, the `sendWithoutWords` method this spec calls for the owner_go basis.
- Precedent: SPEC-10-2-pending-go-store.md, which marks the use (`used_at`, `send_id`) in `takeGo`.

## Tests first
- FR-DRAFTS-02-14 (7): given a taken go for chat "c1", the draft is sent with the go's send id; `pending_goes` holds `used_at` and `send_id`; the log has one `DraftSent` with `automatic` false.
- FR-DRAFTS-02-14 (8): given no go for the chat, the send is refused and no draft is sent (R-DRAFTS-2 still holds).
- FR-DRAFTS-02-14 (9): a go taken for chat "c1" is never used for a send to chat "c2".

## Build
```ts
export type OwnerGoInput = { chatId: string; text: string };
export async function sendWithOwnerGo(input: OwnerGoInput, d: { store: PendingGoStore; createDraft: (chatId: string, text: string) => Promise<DraftRef>; latestCustomerSentAt: number | null; now: number; newSendId: () => string }): Promise<"sent" | "refused">;
```

## Done when
`bun test test/drafts/owner-go-send.test.ts`

## Out of scope
The go's logic (SPEC-07), the store (SPEC-10-2), the Draft method (SPEC-09-4), and the tool registration (SPEC-13). The draft-number path that every other send uses (SPEC-02, SPEC-03).

## Open questions
None.
