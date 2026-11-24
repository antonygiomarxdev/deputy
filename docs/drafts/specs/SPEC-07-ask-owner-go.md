# Spec: the owner's answer to ask_owner is the go (Drafts FRD-02)

Status: Draft

## Summary

Binds the owner's WhatsApp answer to the one question Deputy asked. It approves no other draft (R-DRAFTS-23).

Last change: 2026-11-24, new spec for the local pilot (REQ-15, D31, D38).

## Context

Builds these rows of [FRD-02-owners-go.md](../frd/FRD-02-owners-go.md):

| FR-DRAFTS-02-14 | WHEN | When the owner answers a question Deputy asked the owner, the answer shall be the go for that one answer only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/ask-owner-go.ts | Create | Binds an owner answer to its one question |
| test/drafts/ask-owner-go.test.ts | Create | Tests for FR-DRAFTS-02-14 |
| src/drafts/domain/owner-answer.ts | Create | One owner answer and its question id |

## Interfaces

```ts
export type OwnerAnswer = { questionId: string; text: string };
export function goFor(answer: OwnerAnswer, openQuestions: ReadonlySet<string>): { questionId: string } | null;
```

## Data

None: this spec adds no stored data beyond the log entry it marks.

## Tasks

### Task 1: The ask_owner go
- **Tests first:** `bun test test/drafts/ask-owner-go.test.ts`, written before the code, one test per row above.
- **Done when:** `bun test test/drafts/ask-owner-go.test.ts` passes.

## Out of scope
The Intake control chat that carries the answer. Its interface belongs to Intake's docs, which this spec does not edit.

## Open questions
Q-1 (Lead): how an owner answer reaches Drafts through the Intake control chat. The interface is owned by the Intake docs task (#237); this spec waits for it and does not edit docs/intake/.
