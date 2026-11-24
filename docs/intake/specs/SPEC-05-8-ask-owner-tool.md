# SPEC-05-8: The ask_owner tool and the control chat as the session reads it

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

Registers `ask_owner` (calls `AskOwner`) and makes `get_chat` of the control chat show, on each message, the question it answers, and the open questions. The tool is the only way the session reaches an owner number from the business number.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-5 | WHEN | When the session asks the owner a question with an owner number and a text, Intake sends the text from the business number to that number, records the question with an id and the time, and returns the id. |
| FR-INTAKE-05-6 | IF | If the owner's 24 hour window with the business number is closed, Intake sends nothing, records nothing and returns "window closed", so the session asks in the Claude app and tells the owner to answer on WhatsApp. |
| FR-INTAKE-05-11 | always | When the session reads the control chat, each message shows the question it answers, if any, and the session can list the open questions. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/adapters/mcp/intake-tools.ts` | Change | the `ask_owner` tool and the question fields in `get_chat` |
| `src/main/tools.ts` | Change | passes `askOwner` and `ownerQuestions` to `intakeTools` |
| `test/intake/unit/ask-owner-tool.test.ts` | Create | the tests below |

## Reuses
- `src/intake/adapters/mcp/intake-tools.ts` `intakeTools`: where the intake tools are registered
- `src/main/tools.ts` `mcpServer`: the tool list the server offers
- Precedent: SPEC-05-6-ask-owner.md, the use case the tool calls and its result

## Tests first
FR-INTAKE-05-5, FR-INTAKE-05-6, FR-INTAKE-05-11, written before the code, without it in view, through the tool definitions with fake use cases. FR-INTAKE-05-5: `ask_owner` with an owner number and a text returns the `questionId`. FR-INTAKE-05-6: a `window_closed` result comes back as an error result whose text says the session must ask in the Claude app and tell the owner to answer on WhatsApp. FR-INTAKE-05-11: `get_chat` for the control chat shows each message with the id of the question it answers or none, and an `openQuestions` list; the tool text labels the owner's text as the owner's words, not customer text.

## Build
```ts
// tool "ask_owner": input { number: string, text: string }; output { questionId: string }
// get_chat on a control chat adds: messages[i].answers: string | null, openQuestions: { questionId, text, askedAt }[]
```
The `window_closed`, `not_an_owner_number` and `not_owner` refusals are error results with a plain sentence each.

## Done when
`bun test test/intake/unit/ask-owner-tool.test.ts`

## Out of scope
The use case (SPEC-05-6); linking (SPEC-05-7). Which tool the session uses to answer the customer afterwards is Drafts.

## Open questions
None.
