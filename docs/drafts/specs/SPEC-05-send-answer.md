# SPEC-05: the pilot sends an answer the knowledge backs

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Decides when the pilot session may send an answer without the owner's go: the answer's class is not always-ask and the business knowledge backs it (R-DRAFTS-22). The always-ask list is read from Knowledge's always-ask.md through `AlwaysAskSource`, not from the session. Known limit: the gate trusts the session's `answerClass` and knowledge inputs, as D11 states for an agent with its own tools.

Last change: 2026-11-24, after the review of 7a56758: the go is one unit of work with its approval; closed window tells the owner; the always-ask list comes from Knowledge; reconcile on start; the basis is in the log read; pilotStatsTool is in the application layer.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/auto-send.ts | Create | The automatic-send decision |
| src/drafts/ports/always-ask-source.ts | Create | `AlwaysAskSource`: the port that reads Knowledge's always-ask list |
| test/drafts/auto-send.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-03-safe-send.md, which sends one approved draft through the provider port; this spec decides only whether a send needs a go.
- Dependency: Knowledge's always-ask.md (docs/knowledge/frd/FRD-04-pilot-knowledge-files.md, FR-KNOWLEDGE-04-2), read through `AlwaysAskSource`.

## Tests first
- FR-DRAFTS-02-13 (1): given an answer whose class is not in the always-ask set and knowledge with one entry, `decideAutoSend` returns `send: true`.
- FR-DRAFTS-02-13 (2): given an answer whose class is in the always-ask set, it returns `send: false` with reason `always_ask`, whatever the knowledge.
- FR-DRAFTS-02-13 (3): given an answer with empty knowledge, it returns `send: false` with reason `no_knowledge`.
- FR-DRAFTS-02-13 (4): given the class "Delivery Price" and an always-ask set containing "delivery price", it returns `always_ask`: names are compared after normalizeText, case-insensitively.

## Build
```ts
export type AutoDecision = { send: true } | { send: false; reason: "always_ask" | "no_knowledge" };
export function decideAutoSend(answerClass: string, alwaysAsk: ReadonlySet<string>, knowledge: string[]): AutoDecision;  // names normalized with normalizeText, compared lower-case
export interface AlwaysAskSource { alwaysAsk(): Promise<ReadonlySet<string>>; }  // ports/always-ask-source.ts
```

## Done when
`bun test test/drafts/auto-send.test.ts`

## Out of scope
The window check (SPEC-06), the approval and send (SPEC-09-4, SPEC-13), the automatic mark (SPEC-09-1 to 09-3c), the go (SPEC-07, SPEC-12), and the always-ask file itself (Knowledge).

## Open questions
None.
