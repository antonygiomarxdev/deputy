# SPEC-07: the owner's answer to ask_owner is the go

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Binds one owner answer to one open question. Deputy does not parse which question a reply answers: the session maps the owner's free-text answers to the questions it sent, and calls a tool with `{ questionId, text }`. That call is the go for that one answer, and it approves no other draft (R-DRAFTS-23).

Last change: 2026-11-24, rewritten in the format 4 layout after review of PR 202.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When the session calls the answer tool with a questionId that is open, the call shall be the go for that one answer only, and Deputy shall not parse which question a free reply answers. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/owner-answer.ts | Create | One owner answer and its question id |
| src/drafts/domain/ask-owner-go.ts | Create | Binds an owner answer to its one question |
| test/drafts/ask-owner-go.test.ts | Create | The tests for FR-DRAFTS-02-14 |

## Reuses
- Precedent: SPEC-02-owners-go.md, which binds an owner reply to a draft; this spec binds it to a question instead.

## Tests first
- FR-DRAFTS-02-14 (1): given an answer whose questionId is open, `goFor` returns that questionId.
- FR-DRAFTS-02-14 (2): given a questionId that is not open, it returns null and no go is recorded.
- FR-DRAFTS-02-14 (3): given two open questions and an answer for one, the go names only that one.

## Build
```ts
export type OwnerAnswer = { questionId: string; text: string };
export function goFor(answer: OwnerAnswer, openQuestions: ReadonlySet<string>): { questionId: string } | null;
```

## Done when
`bun test test/drafts/ask-owner-go.test.ts`

## Out of scope
The question batching, the numbered WhatsApp message and the tool's registration (Intake's docs, not edited here). Deputy never guesses a question from a free reply.

## Open questions
Q-1 (Lead): the tool name Intake registers for the `{ questionId, text }` call, which the builder confirms (Intake #237, PR #203). Resolved otherwise by the owner's ruling: Deputy does not parse which question a reply answers; the session maps answers to questions and makes the call.
