# SPEC-14: the Drafts adapter reads Knowledge's always-ask list

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Implements `AlwaysAskSource` (SPEC-05) over Knowledge's `readAlwaysAsk()`, so `send_answer` reads the always-ask list from Knowledge and not from the session (R-DRAFTS-22, D38). Names are normalized with `normalizeText` and kept as a set.

Last change: 2026-11-24, added after review: the always-ask list comes from Knowledge through a port.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/knowledge/knowledge-always-ask.ts | Create | `KnowledgeAlwaysAsk`: implements `AlwaysAskSource` over Knowledge's `readAlwaysAsk`, normalizing each name |

## Reuses
- Precedent: SPEC-05-send-answer.md, which declares the `AlwaysAskSource` port this adapter implements.
- Dependency: Knowledge export `readAlwaysAsk(): Promise<string[]>` from `src/knowledge/index.ts`, added by Knowledge's PR (researcher-3, PR 209). This spec does not add it.
- Dependency: `AlwaysAskSource` in `src/drafts/ports/always-ask-source.ts` (SPEC-05).

## Tests first
- FR-DRAFTS-02-13 (22): given `readAlwaysAsk` returning `["Delivery price", " delivery price "]`, `alwaysAsk()` returns a set with one normalized name for both.
- FR-DRAFTS-02-13 (23): given an empty list, `alwaysAsk()` returns an empty set.

## Build
```ts
export class KnowledgeAlwaysAsk implements AlwaysAskSource {
  constructor(read: () => Promise<string[]>);
  async alwaysAsk(): Promise<ReadonlySet<string>>;  // normalizeText each name, lower-case, as a set
}
```

## Done when
`bun test test/drafts/adapters/knowledge-always-ask.test.ts`

## Out of scope
The always-ask file and its reads (Knowledge), the decision (SPEC-05), and the wiring into the tool (SPEC-11, SPEC-13).

## Open questions
None.
