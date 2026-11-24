# SPEC-09-4: the Draft sends without owner words for the two pilot bases

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Adds `Draft.sendWithoutWords(basis)` for the two pilot bases, `automatic` and `owner_go`. It skips the owner-words check (the R-DRAFTS-19 exception, ADR-013) and emits `DraftSent` with `automatic` true for `automatic` and false for `owner_go`. It is the only path that skips that check.

Last change: 2026-11-24, added after the lead's decision that both pilot sends use the Draft aggregate.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/draft.ts | Change | `sendWithoutWords(basis: "automatic" | "owner_go")`: the sent transition with no owner-words check, for these two bases only |
| test/drafts/draft-without-words.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-09-1-automatic-event.md, which adds the `automatic` field that this method sets.
- Precedent: SPEC-02-owners-go.md, whose `approve` checks the owner's words; this method is the exception to that check and nothing else.

## Tests first
- FR-DRAFTS-02-13 (6): `sendWithoutWords("automatic")` on a draft in the sendable state emits `DraftSent` with `automatic: true` and no owner-words check runs.
- FR-DRAFTS-02-14 (11): `sendWithoutWords("owner_go")` emits `DraftSent` with `automatic: false`.
- FR-DRAFTS-02-14 (12): `sendWithoutWords` on a draft already sent returns `closed` and emits nothing.

## Build
```ts
export type PilotBasis = "automatic" | "owner_go";
// on Draft
sendWithoutWords(input: { basis: PilotBasis; sendId: string; now: Instant }): DraftChange;
```

## Done when
`bun test test/drafts/draft-without-words.test.ts`

## Out of scope
The automatic decision (SPEC-05), the window (SPEC-06), the go store (SPEC-10-2), and the two tools (SPEC-13).

## Open questions
None.
