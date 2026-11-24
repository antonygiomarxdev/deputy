# SPEC-07: the owner's answer to ask_owner is the go

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Binds the owner's WhatsApp answer to the one question Deputy asked. It approves no other draft (R-DRAFTS-23).

Last change: 2026-11-24, rewritten in the format 4 layout after review of PR 202.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When the owner answers a question Deputy asked the owner, the answer shall be the go for that one answer only. (R-DRAFTS-23) |

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
The Intake control chat that carries the answer. Its interface belongs to Intake's docs and is not edited here.

## Open questions
Q-1 (Lead): how an owner answer reaches Drafts through the Intake control chat, including the latest-open-question fallback. The interface is owned by the Intake docs task (#237). This spec waits for it.
