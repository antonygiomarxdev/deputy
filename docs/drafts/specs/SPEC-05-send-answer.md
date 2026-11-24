# SPEC-05: the pilot sends an answer the knowledge backs

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Decides when the pilot session may send an answer without the owner's go: the answer's class is not always-ask and the business knowledge backs it (R-DRAFTS-22). The always-ask set is a parameter; its source is the Knowledge slice (#239).

Last change: 2026-11-24, rewritten in the format 4 layout after review of PR 202.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/auto-send.ts | Create | The automatic-send decision |
| test/drafts/auto-send.test.ts | Create | The tests for FR-DRAFTS-02-13 |

## Reuses
- Precedent: SPEC-03-safe-send.md, which sends one approved draft through the provider port; this spec decides only whether a send needs a go.

## Tests first
- FR-DRAFTS-02-13 (1): given an answer whose class is not in the always-ask set and knowledge with one entry, `decideAutoSend` returns `send: true` with that knowledge.
- FR-DRAFTS-02-13 (2): given an answer whose class is in the always-ask set, it returns `send: false` with reason `always_ask`, whatever the knowledge.
- FR-DRAFTS-02-13 (3): given an answer with empty knowledge, it returns `send: false` with reason `no_knowledge`.

## Build
```ts
export type AutoDecision = { send: true; knowledge: string[] } | { send: false; reason: "always_ask" | "no_knowledge" };
export function decideAutoSend(answerClass: string, alwaysAsk: ReadonlySet<string>, knowledge: string[]): AutoDecision;
```

## Done when
`bun test test/drafts/auto-send.test.ts`

## Out of scope
The window check (SPEC-06), the automatic log mark and pilot counts (SPEC-08), the ask_owner go (SPEC-07) and the always-ask list itself (Knowledge, #239).

## Open questions
Q-1 (Lead): the always-ask set comes from Knowledge's always-ask file (#239), not written yet. This spec takes the set as a parameter, so it does not wait for that file.
