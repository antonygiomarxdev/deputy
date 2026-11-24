# SPEC-05-19: intakeWiring builds the counts adapter and returns the event bus

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

`intakeWiring` builds the SQLite counts adapter on the database with the runtime's resolved time zone, passes it to the runtime as `dailyCounts`, and returns `events`, the bus it already builds, typed as `IntakeEvents` (SPEC-05-18), so the composition root can hand it to Drafts' wiring.

Last change: 2026-11-24, first draft, split from SPEC-05-18 so that each run holds three files.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-05-pilot-owner-chat-and-tools.md

| FR-INTAKE-05-22 | WHEN | When Intake closes a question with an answer, it hands Drafts the question id, the customer chat the question names and the text. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/intake.ts` | Change | `intakeWiring` builds `SqliteDailyCounts`, passes it in and returns `events` |
| `test/intake/unit/intake-events.test.ts` | Create | The tests below |

## Reuses
- `src/main/intake.ts` `intakeWiring`: it builds the `InProcessEventBus` today and keeps it inside
- Precedent: SPEC-05-18-runtime-members-and-events.md, which defines `IntakeEvents` and the runtime members
- Precedent: SPEC-05-12-owner-answered-signal.md, which publishes `OwnerAnswered` on the bus

## Tests first
FR-INTAKE-05-22, written before the code, without it in view, in `test/intake/unit/intake-events.test.ts`. FR-INTAKE-05-22: the `events` that `intakeWiring` returns is the bus the runtime publishes on: a handler subscribed through it receives `OwnerAnswered` once when a question is closed with an answer; the returned value has `subscribe` and no `publish`; a handler that throws does not stop the next handler or the close.

## Build
```ts
// src/main/intake.ts
return { intake, scheduler, listener, listens, events: events as IntakeEvents };
// dailyCounts: new SqliteDailyCounts(d.db, Intl.DateTimeFormat().resolvedOptions().timeZone) passed to createIntakeRuntime
```

## Done when
`bun test test/intake/unit/intake-events.test.ts`

## Out of scope
The type and the runtime members (SPEC-05-18), the adapter (SPEC-05-14) and the subscription handler (Drafts SPEC-11).

## Open questions
None.
