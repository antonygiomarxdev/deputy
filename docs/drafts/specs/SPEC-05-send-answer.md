# Spec: the pilot sends an answer the knowledge backs (Drafts FRD-02)

Status: Draft

## Summary

Builds the decision that lets the pilot session send an answer without the owner's go, when the business knowledge backs it and the class is not always-ask (REQ-15, D31, D38).

Last change: 2026-11-24, new spec for the local pilot (REQ-15, D31, D38).

## Context

Builds these rows of [FRD-02-owners-go.md](../frd/FRD-02-owners-go.md):

| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/auto-send.ts | Create | The automatic-send decision |
| test/drafts/auto-send.test.ts | Create | Tests for FR-DRAFTS-02-13 |
| src/drafts/domain/always-ask.ts | Create | The always-ask class set from the business knowledge |

## Interfaces

```ts
export type AutoDecision = { send: true; knowledge: string[] } | { send: false; reason: "always_ask" | "no_knowledge" };
export function decideAutoSend(answerClass: string, alwaysAsk: ReadonlySet<string>, knowledge: string[]): AutoDecision;
```

## Data

None: this spec adds no stored data beyond the log entry it marks.

## Tasks

### Task 1: The automatic-send decision
- **Tests first:** `bun test test/drafts/auto-send.test.ts`, written before the code, one test per row above.
- **Done when:** `bun test test/drafts/auto-send.test.ts` passes.

## Out of scope
The window check (SPEC-06), the automatic log entry (SPEC-08) and the ask_owner go (SPEC-07).
