# SPEC-05-18: The Intake runtime carries the counts and the answered questions, and the index exports the event type

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

`IntakeRuntime` gains the members Drafts reads: `dailyCounts` (the `IntakeDailyCounts` adapter of SPEC-05-14, passed in as a dependency) and `listAnsweredQuestions` (SPEC-05-17's use case, bound). The same file defines `IntakeEvents`, the subscribe side of the in-process bus, and the Intake index exports it. The wiring that returns the bus is SPEC-05-19.

Last change: 2026-11-24, first draft; the members were missing from SPEC-05-15, which named them only in prose. `IntakeEvents` is defined here and exported from the index.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-05-pilot-owner-chat-and-tools.md

| FR-INTAKE-05-27 | WHEN | When Drafts or the session asks for the day's counts, Intake returns for each day the number of customer messages received and the number of owner questions asked, each counted once, and nothing else: no text, name or chat id. The day is the local date of the computer Deputy runs on (the runtime's resolved time zone), with no setting. (lead decision, 2026-11-24) |
| FR-INTAKE-05-28 | WHEN | When Drafts asks for the answered questions at start, Intake returns each question that has an answer with the question id, the customer chat it names, the answer text and the time of the answer, so that an answer given while Drafts was not running is not lost. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/composition/create-intake-runtime.ts` | Change | `IntakeRuntime` and `IntakeRuntimeDeps` gain the members; defines `IntakeEvents` |
| `src/intake/index.ts` | Change | Exports `IntakeEvents`, `OwnerAnswer` and `IntakeDailyCounts` with `IntakeRuntime` |
| `test/intake/unit/runtime-members.test.ts` | Create | The tests below |

## Reuses
- `src/intake/composition/create-intake-runtime.ts` `createIntakeRuntime`: where the use cases are joined into the runtime
- `src/adapters/events/in-process-event-bus.ts` `InProcessEventBus`: the type `IntakeEvents` picks `subscribe` from
- Precedent: SPEC-05-14-daily-counts.md and SPEC-05-17-list-answered-questions.md, which build the adapter and the use case this run joins

## Tests first
FR-INTAKE-05-27, FR-INTAKE-05-28, written before the code, without it in view, in `test/intake/unit/runtime-members.test.ts` with the in-memory adapters. FR-INTAKE-05-27: `runtime.dailyCounts.between(from, to)` returns one row per local day with the customer messages and the owner questions, and nothing else. FR-INTAKE-05-28: `runtime.listAnsweredQuestions()` returns the answered questions with the question id, the customer chat, the text and the time, and not an open question; the member is SPEC-05-17's use case bound, so it returns what that use case returns. The Intake index exports `IntakeEvents` and its only member is `subscribe`.

## Build
```ts
// create-intake-runtime.ts
export type IntakeEvents = Pick<InProcessEventBus<IntakeEvent>, "subscribe">;
export interface IntakeRuntime { /* existing members */ dailyCounts: IntakeDailyCounts; listAnsweredQuestions: () => Promise<OwnerAnswer[]>; }
// IntakeRuntimeDeps gains: dailyCounts: IntakeDailyCounts  (built in src/main/intake.ts, SPEC-05-19)
// listAnsweredQuestions: ListAnsweredQuestionsUseCase.execute bound (SPEC-05-17)
```

## Done when
`bun test test/intake/unit/runtime-members.test.ts`

## Out of scope
The adapter and the use case themselves (SPEC-05-14, SPEC-05-17), the wiring that builds the counts adapter and returns the bus (SPEC-05-19) and Drafts' use of the members (Drafts SPEC-16-1).

## Open questions
None.
