# SPEC-16-4: Start order: intake, knowledge, drafts, then the supervisor

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

The server builds Intake, then Knowledge, then Drafts with Knowledge's `readAlwaysAsk` and Intake's counts; `draftsWiring` subscribes and reconciles inside itself (SPEC-11) and the server waits for it before it starts the lease supervisor, so the first poll finds every go in place. The end-to-end test proves the order and the restart. Fourth of four runs.

Last change: 2026-11-24, first draft for the Drafts pilot wiring.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows

| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-15 | WHEN | When Deputy restarts, a go shall stay until one send uses it or a newer go for the same chat replaces it. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/serve.ts` | Change | Passes `readAlwaysAsk` and `dailyCounts` to `draftsWiring`, awaits it, and passes `pilot` to `mcpServer` |
| `test/e2e/drafts-pilot.test.ts` | Create | The end-to-end cases below |

## Reuses
- `src/main/serve.ts` `serve`: the start sequence, top to bottom (ADR-013)
- Precedent: SPEC-04-9-start-order-e2e.md, which fixes where Knowledge starts
- Precedent: SPEC-11-owner-answered-wiring.md, which holds the subscription and the reconcile that run here

## Tests first
FR-DRAFTS-02-13, FR-DRAFTS-02-15, in `test/e2e/drafts-pilot.test.ts`, written without the code in view, with the server over standard input and output on temporary folders and the dev provider. Order: `save_always_ask` writes "delivery price" and `send_answer` with that class is refused with `always_ask`, which proves Knowledge was built before Drafts took its list (FR-DRAFTS-02-13); `tools/list` holds the knowledge tools, `send_answer`, `send_owner_go` and `pilot_stats`. Restart: an owner number is added, a question is asked and answered, the server stops, starts again on the same folders, and `send_owner_go` to the customer chat sends with that go (FR-DRAFTS-02-15); an answer recorded while the server was stopped is found by the reconcile at start, before the first poll.

## Build
```ts
// serve.ts order
const wired = intakeWiring(...);
const knowledge = knowledgeWiring({ ..., intake: wired.intake });          // Knowledge SPEC-04-9
const { drafts, approvals, pilot } = await draftsWiring({ ..., readAlwaysAsk: knowledge.readAlwaysAsk, dailyCounts: wired.intake.dailyCounts, listAnsweredQuestions: wired.intake.listAnsweredQuestions, events: wired.events }); // subscribes and reconciles inside (SPEC-11), so it is async
const supervisor = superviseLease(...);   // the scheduler starts here: the first poll comes after the reconcile
```
The members `dailyCounts` and `listAnsweredQuestions` and the returned `events` are those of Intake SPEC-05-18 and SPEC-05-19.

## Done when
`bun test test/e2e/drafts-pilot.test.ts`

## Out of scope
The subscription handler and the reconcile themselves (SPEC-11), the dependency bundles (SPEC-16-1) and the registrations (SPEC-16-2, SPEC-16-3).

## Open questions
None.
