# SPEC-04-6: Build the Knowledge objects and register the tools

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The composition root builds the store, the use cases and the message checks, and adds the six tools to the server's tool list. Its own composition test checks the tool names, the inputs and `readAlwaysAsk` without a server; starting it in the server's start order, the boot test and the end-to-end cases are SPEC-04-9. Sixth of nine runs for FRD-04.

Last change: 2026-11-24, the boot test moved to SPEC-04-9 because it cannot pass before serve.ts calls this builder; this run has its own composition test.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-19 | always | Deputy shall read no spreadsheet or document of the owner and shall hold no credentials of any other service; the session reads what the owner gives and saves the result with `save_catalog`. |
| FR-KNOWLEDGE-04-24 | WHEN | WHEN another slice asks for the always-ask classes, Deputy shall return the entries of always-ask.md as a list, one entry for each non-blank line with its surrounding spaces and a leading list marker removed, and an empty list when the file is missing or holds no entry. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/knowledge.ts` | Create | Builds the Knowledge objects and returns the tools and `readAlwaysAsk` |
| `src/main/tools.ts` | Change | Adds the knowledge tools to the tool list |
| `test/main/knowledge-wiring.test.ts` | Create | The composition test below |

## Reuses
- `src/main/drafts.ts` `draftsWiring`: the pattern of one builder file per slice (ADR-013)
- `src/main/tools.ts` `mcpServer`: the place where the tool list is assembled
- `src/main/drafts.ts` `draftsWiring`: it already hands `intake.isCustomerText` to an Intake adapter (`IntakeCustomerTextCheck`)

## Tests first
FR-KNOWLEDGE-04-19, FR-KNOWLEDGE-04-24, in `test/main/knowledge-wiring.test.ts`, written without the code in view; it calls `knowledgeWiring` on a temporary configuration folder with fake Intake ports. Cases: the returned tools are `read_knowledge`, `save_profile`, `save_catalog`, `save_always_ask`, `save_memory` and `remember`, in that order, and no input shape of them holds a path, a URL, a spreadsheet or a document (FR-KNOWLEDGE-04-19); the builder's only inputs are the configuration folder, the lease, the clock and the Intake ports, so it holds no credential of another service; after a save of `always-ask.md` and a hand edit that adds one line, `readAlwaysAsk()` returns the edited entries on the next call, and an empty list when the file is missing (FR-KNOWLEDGE-04-24).

## Build
```ts
export function knowledgeWiring(d: { configDir: string; lease: OwnerLease; clock: Clock; intake: { isCustomerText: IsCustomerText; readChat: ReadChat }; ownerNumbers: { getOwnerNumbers: GetOwnerNumbers } }): { tools: ToolDefinition[]; readAlwaysAsk: ReadAlwaysAsk }; // the server calls it in SPEC-04-9
```
It also returns `readAlwaysAsk` for the Drafts wiring, and the hand edit of an always-ask line shows in it on the next call. It builds `createIntakeMessageChecks` (SPEC-04-7) from the Intake ports, so the control chat source of `remember` works end to end.

## Done when
`bun test test/main/knowledge-wiring.test.ts`

## Out of scope
The start order in `serve.ts`, the boot test and the end-to-end cases (SPEC-04-9), the Intake adapter for message checks (SPEC-04-7) and a lookup tool for catalog items by name (FRD-01 rows 3 to 5).

## Open questions
None.
