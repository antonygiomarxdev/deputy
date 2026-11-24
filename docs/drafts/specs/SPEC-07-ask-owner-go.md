# SPEC-07: the owner's answer to ask_owner is the go

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Binds one owner answer to one open question. Deputy does not parse which question a reply answers: the session maps the owner's free-text answers to the questions it sent, and calls `answer_question` with `{ questionId, text }`. That call is the go for that one answer, and it approves no other draft (R-DRAFTS-23).

Last change: 2026-11-24, split after review of PR 202 (SPEC-09 added for the log mark; SPEC-08 keeps the counts only).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When the session calls the answer tool with a questionId that Intake holds open, the call shall be the go for that one answer only, and Deputy shall not parse which question a free reply answers. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/owner-answer.ts | Create | One owner answer: the questionId and the text from the answer_question call |
| src/drafts/domain/ask-owner-go.ts | Create | goFor: turns one answer_question call into the go for that one answer |
| test/drafts/ask-owner-go.test.ts | Create | The tests for FR-DRAFTS-02-14 |

## Reuses
- Precedent: SPEC-02-owners-go.md, which binds an owner reply to a draft; this spec binds it to a question instead.

## Tests first
- FR-DRAFTS-02-14 (1): given an answer_question call with a non-empty questionId and text, `goFor` returns `{ questionId }` for that id.
- FR-DRAFTS-02-14 (2): given a call with an empty or blank questionId, it returns null and no go is recorded.
- FR-DRAFTS-02-14 (3): given the call for one question, the go names only that one question and approves no other draft.

## Build
```ts
export type OwnerAnswer = { questionId: string; text: string };
export function goFor(answer: OwnerAnswer): { questionId: string } | null;
```
Intake publishes OwnerAnswered only for a question it held open and closes that question itself, so goFor keeps no list of open questions. The id is taken from the call.

## Done when
`bun test test/drafts/ask-owner-go.test.ts`

## Out of scope
The question batching, the numbered WhatsApp message and the answer_question tool's registration (Intake's docs, not edited here). Deputy never guesses a question from a free reply. The open-question list (Intake).

## Open questions
None: the tool name is answer_question (Intake PR #203); the open-question list is Intake's.
