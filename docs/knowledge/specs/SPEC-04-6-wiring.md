# SPEC-04-6: Wire knowledge into the server

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The composition root builds the store, the use cases and the message checks, and adds the five tools to the server. The end-to-end test saves a profile, edits the file by hand and reads it again without a restart. Sixth of seven runs for FRD-04.

Last change: 2026-11-24, first draft for REQ-15 and D38.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-12 | WHEN | WHEN the owner edits a knowledge file by hand, Deputy shall read the file as it is on the next call, without a restart. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/knowledge.ts` | Create | Builds the Knowledge objects |
| `src/main/tools.ts` | Change | Adds knowledgeTools to the tool list |
| `src/main/serve.ts` | Change | Calls the new builder in the start order |

## Reuses
- `src/main/drafts.ts` `draftsWiring`: the pattern of one builder file per slice (ADR-013)
- `src/main/tools.ts` `mcpServer`: the place where the tool list is assembled
- `src/main/drafts.ts` `draftsWiring`: it already hands `intake.isCustomerText` to an Intake adapter (`IntakeCustomerTextCheck`)

## Tests first
FR-KNOWLEDGE-04-12, in `test/e2e`, written without the code in view: start the server, save a profile, edit the file by hand, call `read_knowledge` and see the edit.

## Build
```ts
export function knowledgeWiring(d: { configDir: string; lease: OwnerLease; clock: Clock; intake: { isCustomerText: IsCustomerText; readChat: ReadChat }; ownerNumbers: { getOwnerNumbers: GetOwnerNumbers } }): { tools: ToolDefinition[] };
```
It builds `createIntakeMessageChecks` (SPEC-04-7) from the Intake ports, so the control chat source of `remember` works end to end.

## Done when
`bun test test/e2e`

## Out of scope
The Intake adapter for message checks (SPEC-04-7) and a lookup tool for catalog items by name (FRD-01 rows 3 to 5).

## Open questions
None.
