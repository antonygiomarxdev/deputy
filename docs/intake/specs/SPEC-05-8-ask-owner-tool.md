# SPEC-05-8: The ask_owner and answer_question tools and the control chat as the session reads it

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

Registers `ask_owner` (calls `AskOwner`) and `answer_question` (calls `AnswerQuestion`), and makes `get_chat` of the control chat return the owner's messages together with the open questions and their ids. The session matches answers to questions and records each one; Deputy does not parse the owner's text.

Last change: 2026-11-24, two tools, no link on messages

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-5 | WHEN | When the session asks the owner one or more questions with an owner number, Intake sends one message from the business number to that number that lists every question still open for it, numbered, records each new question with an id and the time, and returns the ids. |
| FR-INTAKE-05-6 | IF | If the owner's 24 hour window with the business number is closed, Intake sends nothing, records nothing and returns "window closed", so the session asks in the Claude app and tells the owner to answer on WhatsApp. |
| FR-INTAKE-05-9 | WHEN | When the session records an answer with the id of an open question and the owner's text, Intake closes that question and keeps the text with it. |
| FR-INTAKE-05-10 | IF | If the id is not an open question, Intake refuses and changes nothing. |
| FR-INTAKE-05-11 | always | When the session reads the control chat, it gets the owner's messages together with the open questions and their ids. Intake does not match a message to a question; the session does. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/adapters/mcp/intake-tools.ts` | Change | the two tools and `openQuestions` in `get_chat` |
| `src/main/tools.ts` | Change | passes `askOwner`, `answerQuestion` and the open-question read to `intakeTools` |
| `test/intake/unit/ask-owner-tool.test.ts` | Create | the tests below |

## Reuses
- `src/intake/adapters/mcp/intake-tools.ts` `intakeTools`: where the intake tools are registered
- `src/main/tools.ts` `mcpServer`: the tool list the server offers
- Precedent: SPEC-05-6-ask-owner.md, the use case `ask_owner` calls and its result
- Precedent: SPEC-05-7-answer-question.md, the use case `answer_question` calls

## Tests first
FR-INTAKE-05-5, FR-INTAKE-05-6, FR-INTAKE-05-9, FR-INTAKE-05-10, FR-INTAKE-05-11, written before the code, without it in view, through the tool definitions with fake use cases. FR-INTAKE-05-5: `ask_owner` with an owner number and a list of questions returns `questionIds`; an empty list is refused by the input check. FR-INTAKE-05-6: a `window_closed` result comes back as an error result whose text says the session must ask in the Claude app and tell the owner to answer on WhatsApp. FR-INTAKE-05-9: `answer_question` with an id and the owner's text returns `recorded`. FR-INTAKE-05-10: an `unknown_question` result is an error result with a plain sentence; a `not_owner_words` result is an error result saying the text must be the owner's own words from the control chat. FR-INTAKE-05-11: `get_chat` for the control chat returns the messages and an `openQuestions` list of `{ questionId, text, askedAt }`, with no question attached to any message; the tool text labels the owner's text as the owner's words, not customer text, and says the session must match answers to questions.

## Build
```ts
// tool "ask_owner": input { number: string, questions: string[] (at least one) }; output { questionIds: string[] }
// tool "answer_question": input { questionId: string, text: string }; output { recorded: true }
// get_chat on a control chat adds: openQuestions: { questionId, text, askedAt }[]
```
The `window_closed`, `not_an_owner_number`, `not_owner`, `unknown_question` and `not_owner_words` refusals are error results with a plain sentence each.

## Done when
`bun test test/intake/unit/ask-owner-tool.test.ts`

## Out of scope
The use cases (SPEC-05-6, SPEC-05-7); the pending tools (SPEC-05-3). Which tool the session uses to answer the customer afterwards is Drafts.

## Open questions
None.
