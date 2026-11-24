# SPEC-16-2: Register send_answer and send_owner_go in the server

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

The tool list gets the two pilot send tools, built from the dependency bundles of SPEC-16-1. The registration spreads the bundle, so a field added to `autoSendDeps` later (the token check on send_answer) reaches the tool with no change here. Second of five runs.

Last change: 2026-11-24, first draft for the Drafts pilot wiring.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows

| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/tools.ts` | Change | `mcpServer` takes `pilot` and adds `sendAnswerTool` and `sendOwnerGoTool` to the list |
| `test/main/pilot-tools-wiring.test.ts` | Create | The composition test below |

## Reuses
- `src/main/tools.ts` `mcpServer`: the place where the tool list is assembled
- Precedent: SPEC-13-pilot-tools.md, which builds the two handlers this run registers
- Precedent: SPEC-16-1-pilot-dependencies.md, which builds the bundles

## Tests first
FR-DRAFTS-02-13, FR-DRAFTS-02-14, in `test/main/pilot-tools-wiring.test.ts`, written without the code in view; it calls `mcpServer` with fake bundles. Cases: the tool list holds `send_answer` and `send_owner_go` (FR-DRAFTS-02-13, FR-DRAFTS-02-14); a call of `send_answer` reaches the `decide` and `driveSend` of the `autoSendDeps` it was given, and a field added to that object (a test adds `guard`) is visible to the handler without a change in this file; a call of `send_owner_go` reaches the `ownerGoDeps`; the always-ask class of a call comes from `autoSendDeps.alwaysAsk`, never from the input.

## Build
```ts
// in mcpServer(d: { ..., pilot: PilotWiring })
sendAnswerTool({ ...d.pilot.autoSendDeps }),   // spread: later fields flow through
sendOwnerGoTool(d.pilot.ownerGoDeps),
```

## Done when
`bun test test/main/pilot-tools-wiring.test.ts`

## Out of scope
The handlers (SPEC-13), pilot_stats (SPEC-16-3), the token check (a later spec) and the start order (SPEC-16-4).

## Open questions
None.
