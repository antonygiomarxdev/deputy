# SPEC-05-28: The owner_answers tool

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

Registers the `owner_answers` tool, which has no input and returns the result of SPEC-05-27 with the owner's text labeled as the owner's words. It is the dispatcher's only way to read the control chat.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-35 | WHEN | When the dispatcher asks for the owner's answers, Intake returns the messages the owner sent in the control chat since the oldest open question was asked, and the open questions with their ids and text, and nothing from any customer chat. With no open question it returns none. (Proposed, lead decision, docs/adr/ADR-019.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/adapters/mcp/intake-tools.ts` | Change | the `owner_answers` tool |
| `src/main/tools.ts` | Change | passes the use case to `intakeTools` |
| `test/intake/unit/owner-answers-tool.test.ts` | Create | the tests below |

## Reuses
- `src/intake/adapters/mcp/intake-tools.ts` `intakeTools`: where the intake tools are registered
- Precedent: SPEC-05-27-owner-answers.md, the use case the tool calls
- Precedent: SPEC-05-8-ask-owner-tool.md, the tool that labels the owner's text

## Tests first
FR-INTAKE-05-35, written before the code, without it in view, through the tool definition with a fake use case. FR-INTAKE-05-35: the tool takes no input and returns the questions and the messages of the use case; its text labels each message as the owner's words and says that the session matches answers to questions and records them with `answer_question`; a result with no questions says there is nothing to answer; the tool is in the list; and with a fake use case that returns only owner messages, a customer text planted in the fake chat store never appears in the tool result.

## Build
```ts
// tool owner_answers: no input; output { questions: [{ questionId, text, askedAt }], messages: [{ ownerChat, text, sentAt }] }
```

## Done when
`bun test test/intake/unit/owner-answers-tool.test.ts`

## Out of scope
The use case (SPEC-05-27); the dispatcher's tool list (Setup SPEC-05-13).

## Open questions
None.
