# SPEC-04-9: Start Knowledge in the server's start order and prove it end to end

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The server starts Knowledge after the lease and the Intake wiring and passes its tools to the tool list; the new end-to-end test saves a profile, shows that a second server on the same folders is refused, and shows that a hand edit is read on the next call. Ninth run for FRD-04, after SPEC-04-6.

Last change: 2026-11-24, split out of SPEC-04-6.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-1 | always | Deputy shall keep the owner's knowledge in four plain text files, profile.md, catalog.md, memory.md and always-ask.md, in the folder `knowledge` of the configuration folder, and shall take no file path from any tool input. |
| FR-KNOWLEDGE-04-8 | IF | IF this process is not the owner process, THEN Deputy shall refuse a save or a remember with `not_owner` and change nothing. |
| FR-KNOWLEDGE-04-12 | WHEN | WHEN the owner edits a knowledge file by hand, Deputy shall read the file as it is on the next call, without a restart. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/serve.ts` | Change | Calls `knowledgeWiring` after the lease and the Intake wiring and hands the tools on |
| `test/e2e/knowledge.test.ts` | Create | The end-to-end cases below |

## Reuses
- `src/main/serve.ts` `serve`: the start sequence, top to bottom (ADR-013)
- `test/e2e/boot.test.ts` `startServer`: the harness that starts the server over standard input and output on temporary folders
- Precedent: SPEC-04-6-wiring.md, which builds the objects and registers the tools

## Tests first
FR-KNOWLEDGE-04-1, FR-KNOWLEDGE-04-8, FR-KNOWLEDGE-04-12, in `test/e2e/knowledge.test.ts`, written without the code in view. Builds the objects on the right folder: the server saves a profile and the file `profile.md` exists in the `knowledge` folder of the configuration folder (FR-KNOWLEDGE-04-1). Start order: knowledge is built after the lease and the Intake wiring, so a second server on the same folders is read-only and its `save_profile` is refused with `not_owner` (FR-KNOWLEDGE-04-8). Hand edit: save a profile, edit the file by hand, call `read_knowledge` and see the edit (FR-KNOWLEDGE-04-12).

## Build
```ts
// serve.ts, after intakeWiring and before superviseLease:
const knowledge = knowledgeWiring({ configDir: settings.configDir, lease, clock, intake: wired.intake, ownerNumbers });
// mcpServer({ ..., knowledgeTools: knowledge.tools }) and, for the Drafts wiring, knowledge.readAlwaysAsk
```
The order is: intake, then knowledge, then drafts.

## Done when
`bun test test/e2e/knowledge.test.ts`

## Out of scope
Building the objects and registering the tools (SPEC-04-6) and the Drafts side that reads `readAlwaysAsk` (the Drafts wiring spec).

## Open questions
None.
