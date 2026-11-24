# SPEC-09-4: the Draft approves without owner words for the two pilot bases

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Adds `Draft.approveWithoutWords(basis, words)` for the two pilot bases, `automatic` and `owner_go`. It emits the normal `Approved` event (an approval with text, text hash and send id) without the owner-words check, which is the R-DRAFTS-19 exception (ADR-013). The send then runs the existing path (driveSend), unchanged. `DraftSent.automatic` is `basis === "automatic"`. Depends on SPEC-09-5b for the basis column.

Last change: 2026-11-24, after the lead's decision: approveWithoutWords replaces sendWithoutWords and the approval records its basis.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/draft.ts | Change | `approveWithoutWords(basis, words)`: the Approved transition with no owner-words check, for these two bases only; the existing closed and in-flight checks still apply |
| src/drafts/domain/approval.ts | Change | `Approval` gains `basis: "owner_words" | "automatic" | "owner_go"` |
| test/drafts/draft-without-words.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-02-owners-go.md, whose `Draft.approve` this method mirrors minus the owner-words check.
- Precedent: SPEC-09-1-automatic-event.md, which sets the `automatic` field of `DraftSent`.

## Tests first
- FR-DRAFTS-02-13 (6): `approveWithoutWords("automatic", "")` on a draft in the approvable state emits `Approved` with `basis: "automatic"` and `ownerWords` "", and the later sent event has `automatic: true`.
- FR-DRAFTS-02-14 (11): `approveWithoutWords("owner_go", "yes")` emits `Approved` with `basis: "owner_go"` and `ownerWords` "yes", and the later sent event has `automatic: false`.
- FR-DRAFTS-02-14 (12): `approveWithoutWords` on a closed or in-flight draft returns the same refusal as `approve`.

## Build
```ts
export type PilotBasis = "automatic" | "owner_go";
// on Draft
approveWithoutWords(input: { basis: PilotBasis; words: string; shownText: string; approvalId: string; sendId: string; textHash: string; now: Instant }): ApproveChange;
```

## Done when
`bun test test/drafts/draft-without-words.test.ts`

## Out of scope
The migration and the repository (SPEC-09-5a, 09-5b), the send itself (driveSend, unchanged), the decision (SPEC-05), the go store (SPEC-10-2), and the tools (SPEC-13).

## Open questions
None.
