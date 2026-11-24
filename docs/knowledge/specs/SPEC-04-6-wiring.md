# SPEC-04-6: Build the Knowledge objects and register the tools

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The composition root builds the store, the use cases and the message checks, and adds the six tools to the server's tool list; the boot test expects them. Starting it in the server's start order and the end-to-end cases are SPEC-04-9. Sixth of nine runs for FRD-04.

Last change: 2026-11-24, split: the start order and the end-to-end cases moved to SPEC-04-9 so that this run holds three files.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-19 | always | Deputy shall read no spreadsheet or document of the owner and shall hold no credentials of any other service; the session reads what the owner gives and saves the result with `save_catalog`. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/knowledge.ts` | Create | Builds the Knowledge objects and returns the tools and `readAlwaysAsk` |
| `src/main/tools.ts` | Change | Adds the knowledge tools to the tool list |
| `test/e2e/boot.test.ts` | Change | The expected tool list holds the six knowledge tools |

## Reuses
- `src/main/drafts.ts` `draftsWiring`: the pattern of one builder file per slice (ADR-013)
- `src/main/tools.ts` `mcpServer`: the place where the tool list is assembled
- `src/main/drafts.ts` `draftsWiring`: it already hands `intake.isCustomerText` to an Intake adapter (`IntakeCustomerTextCheck`)

## Tests first
FR-KNOWLEDGE-04-19, in `test/e2e/boot.test.ts`, written without the code in view: the expected tool list holds `read_knowledge`, `save_profile`, `save_catalog`, `save_always_ask`, `save_memory` and `remember`, in the order the tool list assembles them, so its expected array changes in this run; no tool in it takes a path, a URL, a spreadsheet or a document, and the builder takes no credential of any other service (its only inputs are the configuration folder, the lease, the clock and the Intake ports).

## Build
```ts
export function knowledgeWiring(d: { configDir: string; lease: OwnerLease; clock: Clock; intake: { isCustomerText: IsCustomerText; readChat: ReadChat }; ownerNumbers: { getOwnerNumbers: GetOwnerNumbers } }): { tools: ToolDefinition[]; readAlwaysAsk: ReadAlwaysAsk }; // the server calls it in SPEC-04-9
```
It also returns `readAlwaysAsk` for the Drafts wiring, and the hand edit of an always-ask line shows in it on the next call. It builds `createIntakeMessageChecks` (SPEC-04-7) from the Intake ports, so the control chat source of `remember` works end to end.

## Done when
`bun test test/e2e/boot.test.ts`

## Out of scope
The start order in `serve.ts` and the end-to-end cases (SPEC-04-9), the Intake adapter for message checks (SPEC-04-7) and a lookup tool for catalog items by name (FRD-01 rows 3 to 5).

## Open questions
None.
