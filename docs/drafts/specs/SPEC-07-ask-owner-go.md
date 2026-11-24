# SPEC-07: the owner's answer to ask_owner is the go

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Turns Intake's OwnerAnswered signal (from the session's answer_question call) into the go for the draft the session prepared for that question. Intake holds the open questions and publishes only for an open one, so this spec takes no list of open questions (R-DRAFTS-23).

Last change: 2026-11-24, rewritten after review of PR 202 (SPEC-09 split into 09-1 to 09-3; SPEC-07 takes the go from Intake's OwnerAnswered).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When the session calls the answer tool with a questionId that Intake holds open, the call shall be the go for that one answer only, and Deputy shall not parse which question a free reply answers. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/owner-answer.ts | Create | The owner's answer: questionId, text and time, the same fields as Intake's OwnerAnswered |
| src/drafts/domain/ask-owner-go.ts | Create | goFor: the go for the draft of that question |
| test/drafts/ask-owner-go.test.ts | Create | The tests for FR-DRAFTS-02-14 |

## Reuses
- Precedent: SPEC-02-owners-go.md, which records an owner's go as an approval entry with the owner's words (ADR-003); this spec records the go the same way, for the draft of one question.

## Tests first
- FR-DRAFTS-02-14 (1): given OwnerAnswered `{ questionId: "3", text: "yes" }` and a draft recorded for question "3", `goFor` returns that draft and the owner's words "yes".
- FR-DRAFTS-02-14 (2): given a questionId with no draft, `goFor` returns null and records no approval.
- FR-DRAFTS-02-14 (3): given an empty questionId, `goFor` returns null and records no approval.

## Build
```ts
export type OwnerAnswer = { questionId: string; text: string; at: number };
export function goFor(answer: OwnerAnswer, draftFor: (questionId: string) => number | null): { draft: number; ownerWords: string } | null;
```
Where the go is recorded: the approval entry in Drafts' log (`approved`, with the owner's words in `owner_words`, ADR-003), for the draft `draftFor` returns. Where the link is stored: Intake's `owner_questions` holds the question and closes it on OwnerAnswered; Drafts stores the question id on the draft when the session prepares it, and `draftFor` reads that.

## Done when
`bun test test/drafts/ask-owner-go.test.ts`

## Out of scope
The question batching, the numbered WhatsApp message and the answer_question tool's registration (Intake). Deputy never guesses a question from a free reply.

## Open questions
Q-1 (Lead): the draft's question id needs a column on drafts (a migration, in the draft-creation spec), which no spec builds yet. Until that spec exists this go has no draft to find.
