# SPEC-05-18: The Intake runtime carries the counts and the answered questions, and the wiring returns its event bus

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

`IntakeRuntime` gains the members Drafts reads, `dailyCounts` and `listAnsweredQuestions`, and `intakeWiring` returns `events`, the subscribe side of the in-process bus, so the composition root can hand them to Drafts' wiring. It builds nothing new: it joins the adapters and use cases of SPEC-05-14 and SPEC-05-17.

Last change: 2026-11-24, first draft; the members were missing from SPEC-05-15, which named them only in prose.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-05-pilot-owner-chat-and-tools.md

| FR-INTAKE-05-22 | WHEN | When Intake closes a question with an answer, it hands Drafts the question id, the customer chat the question names and the text. |
| FR-INTAKE-05-27 | WHEN | When Drafts or the session asks for the day's counts, Intake returns for each day the number of customer messages received and the number of owner questions asked, each counted once, and nothing else: no text, name or chat id. The day is the local date of the computer Deputy runs on (the runtime's resolved time zone), with no setting. (lead decision, 2026-11-24) |
| FR-INTAKE-05-28 | WHEN | When Drafts asks for the answered questions at start, Intake returns each question that has an answer with the question id, the customer chat it names, the answer text and the time of the answer, so that an answer given while Drafts was not running is not lost. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/composition/create-intake-runtime.ts` | Change | `IntakeRuntime` and `IntakeRuntimeDeps` gain the members |
| `src/main/intake.ts` | Change | `intakeWiring` builds the counts adapter, passes it in and returns `events` |
| `test/intake/unit/runtime-members.test.ts` | Create | The tests below |

## Reuses
- `src/intake/composition/create-intake-runtime.ts` `createIntakeRuntime`: where the use cases are joined into the runtime
- `src/main/intake.ts` `intakeWiring`: it builds the `InProcessEventBus` today and keeps it inside
- Precedent: SPEC-05-14-daily-counts.md, SPEC-05-17-list-answered-questions.md and SPEC-05-12-owner-answered-signal.md, which build and publish what this run joins

## Tests first
FR-INTAKE-05-22, FR-INTAKE-05-27, FR-INTAKE-05-28, written before the code, without it in view, in `test/intake/unit/runtime-members.test.ts` with the in-memory adapters. FR-INTAKE-05-27: `runtime.dailyCounts.between(from, to)` returns one row per local day with the customer messages and the owner questions, and nothing else. FR-INTAKE-05-28: `runtime.listAnsweredQuestions()` returns the answered questions with the question id, the customer chat, the text and the time, and not an open question. FR-INTAKE-05-22: the `events` that `intakeWiring` returns is the bus the runtime publishes on: a handler subscribed through it receives `OwnerAnswered` when a question is closed, once. `events` exposes only `subscribe`.

## Build
```ts
// create-intake-runtime.ts
export interface IntakeRuntime { /* existing members */ dailyCounts: IntakeDailyCounts; listAnsweredQuestions: () => Promise<OwnerAnswer[]>; }
// IntakeRuntimeDeps gains: dailyCounts: IntakeDailyCounts  (built in src/main/intake.ts)
// src/main/intake.ts: intakeWiring returns { intake, scheduler, listener, listens, events: Pick<InProcessEventBus<IntakeEvent>, "subscribe"> }
```
`intakeWiring` builds `SqliteDailyCounts` on the database with the runtime's resolved time zone (SPEC-05-14) and passes it as `dailyCounts`; `listAnsweredQuestions` is the use case of SPEC-05-17 bound.

## Done when
`bun test test/intake/unit/runtime-members.test.ts`

## Out of scope
The adapter and the use case themselves (SPEC-05-14, SPEC-05-17), the export from the Intake index (SPEC-05-15) and Drafts' use of the members (Drafts SPEC-16-1).

## Open questions
None.
