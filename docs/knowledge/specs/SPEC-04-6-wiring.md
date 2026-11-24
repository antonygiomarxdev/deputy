# SPEC-04-6: Wire knowledge into the server

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The composition root builds the store, the use cases and the message checks, and adds the six tools to the server. The end-to-end test saves a profile, edits the file by hand and reads it again without a restart. Sixth of seven runs for FRD-04.

Last change: 2026-11-24, rows and named tests for what the wiring holds: the objects, the tool list and the start order.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-1 | always | Deputy shall keep the owner's knowledge in four plain text files, profile.md, catalog.md, memory.md and always-ask.md, in the folder `knowledge` of the configuration folder, and shall take no file path from any tool input. |
| FR-KNOWLEDGE-04-8 | IF | IF this process is not the owner process, THEN Deputy shall refuse a save or a remember with `not_owner` and change nothing. |
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
FR-KNOWLEDGE-04-1, FR-KNOWLEDGE-04-8, FR-KNOWLEDGE-04-12, in `test/e2e`, written without the code in view. Builds the objects: the server saves a profile and the file `profile.md` exists in the `knowledge` folder of the configuration folder (FR-KNOWLEDGE-04-1). Adds the tools: `test/e2e/boot.test.ts` expects the tool list to hold `read_knowledge`, `save_profile`, `save_catalog`, `save_always_ask`, `save_memory` and `remember`, in the order the tool list assembles them, so its expected array changes in this run. Start order: knowledge is built after the lease and the Intake wiring, so a second server on the same folders is read-only and its `save_profile` is refused with `not_owner` (FR-KNOWLEDGE-04-8). Hand edit: save a profile, edit the file by hand, call `read_knowledge` and see the edit (FR-KNOWLEDGE-04-12).

## Build
```ts
export function knowledgeWiring(d: { configDir: string; lease: OwnerLease; clock: Clock; intake: { isCustomerText: IsCustomerText; readChat: ReadChat }; ownerNumbers: { getOwnerNumbers: GetOwnerNumbers } }): { tools: ToolDefinition[]; readAlwaysAsk: ReadAlwaysAsk };
```
It also returns `readAlwaysAsk` for the Drafts wiring, and the hand edit of an always-ask line shows in it on the next call. It builds `createIntakeMessageChecks` (SPEC-04-7) from the Intake ports, so the control chat source of `remember` works end to end.

## Done when
`bun test test/e2e`

## Out of scope
The Intake adapter for message checks (SPEC-04-7) and a lookup tool for catalog items by name (FRD-01 rows 3 to 5).

## Open questions
None.
