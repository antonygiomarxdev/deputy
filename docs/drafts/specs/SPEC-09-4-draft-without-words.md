# SPEC-09-4: the Draft approves without owner words for the two pilot bases

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Adds `Draft.approveWithoutWords(input)` for the two pilot bases, `automatic` and `owner_go`. It emits the normal `Approved` event with `basis` set and empty owner words for `automatic`. It skips the owner-words check, the `not_shown` check and the `text_differs` check, because the session wrote the text and the owner never saw an automatic one (R-DRAFTS-19 exception, ADR-013). The closed, in-flight and already-approved checks stay. The send runs the existing path unchanged. `DraftSent.automatic` is `basis === "automatic"`. Depends on SPEC-09-5b-1 for the basis column.

Last change: 2026-11-24, after the review of a17110b: the audit is the approval row; approveWithoutWords skips the shown and text checks; approvals carry an optional basis; counts read approvals; CheckApprovals reports automatic.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/draft.ts | Change | `approveWithoutWords(input)`: the Approved transition for the two bases, skipping the owner-words, not_shown and text_differs checks |
| src/drafts/domain/approval.ts | Change | `Approval` gains `basis?: "owner_words" | "automatic" | "owner_go"`; missing means `owner_words` |
| test/drafts/draft-without-words.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-02-owners-go.md, whose `Draft.approve` this method mirrors minus the checks named in the summary.
- Precedent: SPEC-09-1-automatic-event.md, which sets the `automatic` field of `DraftSent`.

## Tests first
- FR-DRAFTS-02-13 (6): `approveWithoutWords` with basis "automatic" emits `Approved` with `basis: "automatic"` and empty owner words; the later sent event has `automatic: true`.
- FR-DRAFTS-02-14 (11): `approveWithoutWords` with basis "owner_go" and words "yes" emits `Approved` with `basis: "owner_go"`; the later sent event has `automatic: false`.
- FR-DRAFTS-02-14 (12): `approveWithoutWords` on a closed or in-flight draft returns the same refusal as `approve`; on an already-approved draft it returns `already_approved`.
- FR-DRAFTS-02-14 (13): `approveWithoutWords` on a draft that was never shown to the owner succeeds, where `approve` refuses with `not_shown`.
- FR-DRAFTS-02-14 (14): `approveWithoutWords` with a text that differs from the current text succeeds, where `approve` refuses with `text_differs`.

## Build
```ts
export type PilotBasis = "automatic" | "owner_go";
// on Draft
approveWithoutWords(input: { basis: PilotBasis; words: string; shownText: string; approvalId: string; sendId: string; textHash: string; now: Instant }): ApproveChange;
```

## Done when
`bun test test/drafts/draft-without-words.test.ts`

## Out of scope
The migration and repository (SPEC-09-5a, 09-5b-1 and 09-5b-2), the send itself (driveSend, unchanged), the CheckApprovals report (SPEC-09-6c), the decision (SPEC-05), the go store (SPEC-10-2), and the tools (SPEC-13).

## Open questions
None.
