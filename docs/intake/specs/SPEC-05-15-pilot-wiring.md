# SPEC-05-15: The composition builds the pilot use cases and hands them to the tools

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The composition root builds the pilot's Intake use cases (`AskOwner`, `AnswerQuestion`, `ListPending`, `SetOwnerNumbers`, `AdoptBusinessNumber`, the owner-question repository, `IntakeDailyCounts`), exports their ports from the Intake index, and passes them to `intakeTools`. After it a session sees `ask_owner`, `answer_question`, `list_pending`, `set_owner_numbers` and the business number is adopted at start.

Last change: 2026-11-24, first draft

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-5 | WHEN | When the session asks the owner one or more questions with an owner number, Intake sends one message from the business number to that number that lists every question still open for it, numbered, records each new question with an id and the time, and returns the ids. |
| FR-INTAKE-05-9 | WHEN | When the session records an answer with the id of an open question and the owner's text, Intake closes that question and keeps the text with it. |
| FR-INTAKE-05-13 | WHEN | When the session asks for the pending chats, Intake lists each chat whose latest customer message is newer than its latest answer, inside the pending window of FR-INBOX-01-6, newest first, each with the time its customer window closes. The control chat is never listed. |
| FR-INTAKE-05-15 | WHEN | When Deputy starts with the Kapso provider and no business number is recorded, Intake asks the provider for the connected number and records it as the business number, logged like an owner-number change with the command "provider". |
| FR-INTAKE-05-17 | WHEN | When the session calls set_owner_numbers with a number and the owner's words, Intake parses the number with the owner's country as the default region (ADR-012), writes nothing, and returns the E.164 form, whether it is already an owner number and how many customer messages came from it. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/intake.ts` | Change | builds the pilot use cases and the repository |
| `src/intake/index.ts` | Change | exports the pilot ports |
| `test/intake/unit/pilot-wiring.test.ts` | Create | the tests below |

## Reuses
- `src/main/intake.ts` `intakeWiring`: where the intake runtime and its repositories are built
- `src/intake/index.ts` `createIntakeRuntime`: the runtime the use cases join
- Precedent: SPEC-05-6-ask-owner.md, SPEC-05-7-answer-question.md, SPEC-05-2-list-pending.md, SPEC-05-9-adopt-business-number.md and SPEC-05-10-set-owner-numbers.md, the use cases this file builds

## Tests first
FR-INTAKE-05-5, FR-INTAKE-05-9, FR-INTAKE-05-13, FR-INTAKE-05-15, FR-INTAKE-05-17, written before the code, without it in view, over stdio with `bun src/main.ts serve` and a fake provider. FR-INTAKE-05-5: `tools/list` holds `ask_owner`, and a call with an owner number, an open window and one question sends one message and returns a question id. FR-INTAKE-05-9: `answer_question` with that id and the owner's words closes it and the Drafts-facing event is published once. FR-INTAKE-05-13: `list_pending` lists a chat with an unanswered customer message. FR-INTAKE-05-15: at start with no business number recorded and a provider that offers one, the number is recorded. FR-INTAKE-05-17: `set_owner_numbers` describes a number and writes nothing. The Intake index exports the ports of the pilot and `IntakeDailyCounts`, and `src/shared/` still imports nothing from a slice.

## Build
`intakeWiring` builds `SqliteOwnerQuestionRepository` on the same database, joins it to the unit of work (`repos.questions`) and returns the use cases. `src/intake/index.ts` adds `export type` lines for `AskOwner`, `AnswerQuestion`, `ListPending`, `SetOwnerNumbers`, `AdoptBusinessNumber`, `OwnerAnswered` and `IntakeDailyCounts`. The tool wiring in `main/tools.ts` is done by the tool specs (SPEC-05-3, SPEC-05-8, SPEC-05-11) and the call to the adoption by SPEC-05-9.

## Done when
`bun test test/intake/unit/pilot-wiring.test.ts`

## Out of scope
The tools themselves (SPEC-05-3, SPEC-05-8, SPEC-05-11), the adoption call in `serve.ts` (SPEC-05-9), Drafts' use of the counts.

## Open questions
None.
