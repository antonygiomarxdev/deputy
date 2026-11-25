# SPEC-04-9: Start Knowledge in the server's start order and prove it end to end

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The server starts Knowledge after the lease and the Intake wiring and passes its tools to the tool list; the boot test expects the six tools, and the new end-to-end test saves a profile, shows that a second server on the same folders is refused, and shows that a hand edit is read on the next call. Ninth run for FRD-04, after SPEC-04-6.

Last change: 2026-11-24, split out of SPEC-04-6; it holds the boot test, which can pass only after serve.ts calls the builder.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-1 | always | Deputy shall keep the owner's knowledge in four plain text files, profile.md, catalog.md, memory.md and always-ask.md, in the folder `knowledge` of the configuration folder, and shall take no file path from any tool input. |
| FR-KNOWLEDGE-04-8 | IF | IF this process is not the owner process, THEN Deputy shall refuse a save or a remember with `not_owner` and change nothing. |
| FR-KNOWLEDGE-04-12 | WHEN | WHEN the owner edits a knowledge file by hand, Deputy shall read the file as it is on the next call, without a restart. |
| FR-KNOWLEDGE-04-19 | always | Deputy shall read no spreadsheet or document of the owner and shall hold no credentials of any other service; the session reads what the owner gives and saves the result with `save_catalog`. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/serve.ts` | Change | Calls `knowledgeWiring` after the lease and the Intake wiring and hands the tools on |
| `test/e2e/boot.test.ts` | Change | The expected tool list holds the six knowledge tools |
| `test/e2e/knowledge.test.ts` | Create | The end-to-end cases below |

## Reuses
- `src/main/serve.ts` `serve`: the start sequence, top to bottom (ADR-013)
- `test/e2e/boot.test.ts` `startServer`: the harness that starts the server over standard input and output on temporary folders
- Precedent: SPEC-04-6-wiring.md, which builds the objects and registers the tools

## Tests first
FR-KNOWLEDGE-04-1, FR-KNOWLEDGE-04-8, FR-KNOWLEDGE-04-12, FR-KNOWLEDGE-04-19, in `test/e2e/knowledge.test.ts` and `test/e2e/boot.test.ts`, written without the code in view. Tools: `test/e2e/boot.test.ts` expects the tool list over standard input and output to hold `read_knowledge`, `save_profile`, `save_catalog`, `save_always_ask`, `save_memory` and `remember`, in the order the tool list assembles them, so its expected array changes in this run, and none of them reads a spreadsheet or a document (FR-KNOWLEDGE-04-19). Builds the objects on the right folder: the server saves a profile and the file `profile.md` exists in the `knowledge` folder of the configuration folder (FR-KNOWLEDGE-04-1). Start order: knowledge is built after the lease and the Intake wiring, so a second server on the same folders is read-only and its `save_profile` is refused with `not_owner` (FR-KNOWLEDGE-04-8). Hand edit: save a profile, edit the file by hand, call `read_knowledge` and see the edit (FR-KNOWLEDGE-04-12).

## Build
```ts
// serve.ts, after intakeWiring and before superviseLease:
const knowledge = knowledgeWiring({ configDir: settings.configDir, lease, clock, intake: wired.intake, ownerNumbers });
// mcpServer({ ..., knowledgeTools: knowledge.tools }) and, for the Drafts wiring, knowledge.readAlwaysAsk
```
The order is: intake, then knowledge, then drafts.

## Done when
`bun test test/e2e/boot.test.ts test/e2e/knowledge.test.ts`

## Out of scope
Building the objects, registering the tools and the composition test (SPEC-04-6) and the Drafts side that reads `readAlwaysAsk` (the Drafts wiring spec).

## Open questions
None.
