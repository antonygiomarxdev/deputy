# SPEC-05-9: the daily loop steps in the skill

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Write loop.md, the daily loop the skill runs each round: check and read first, answer what the knowledge backs, ask the owner once for the rest, match the owner's answers, and handle a closed window. SKILL.md links it.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-22 | WHEN | WHEN a round of the daily loop starts, the skill shall check for new messages, list the pending chats and read the knowledge before it answers any chat. (Proposed, lead decision.) |
| FR-SETUP-05-23 | WHEN | WHEN a pending question is backed by the knowledge and its class is not in the always-ask list, the triage helper shall answer it by sending the answer itself with the token of that chat. (Proposed, lead decision.) |
| FR-SETUP-05-24 | WHEN | WHEN a pending question is in an always-ask class or the knowledge does not back it, the triage helper shall return one line with the question, and the dispatcher shall collect the lines and ask the owner once per round, in one message that lists every open question. (Proposed, lead decision.) |
| FR-SETUP-05-25 | WHEN | WHEN the owner has answered in the control chat, the dispatcher shall match each answer to its question, close the question, and send the reply to the customer with the owner's answer as the go. (Proposed, lead decision.) |
| FR-SETUP-05-26 | IF | IF a send is refused because the customer's window is closed, THEN the skill shall tell the owner in the session that the window is closed and shall not retry. (Proposed, lead decision.) |
| FR-SETUP-05-27 | IF | IF the owner's own window is closed when the skill asks the owner, THEN the skill shall tell the owner in the session to write any message to the business number, and once that message has arrived the skill shall ask again, so that the questions that were not sent go out in one numbered message and the owner's answers close the recorded questions. (Proposed, lead decision.) |
| EX-10 | RULE-5 | positive | The knowledge backs the opening hours and opening hours are not always-ask | A customer asks when the shop opens | The triage helper sends the answer itself |
| EX-11 | RULE-5 | negative | The delivery price is an always-ask class | A customer asks for a delivery price | The triage helper sends nothing and returns the question for the owner |
| EX-12 | RULE-6 | positive | The customer's window is closed | The skill tries to send | The skill tells the owner and does not retry |
| EX-13 | RULE-6 | boundary | The owner's window is closed | The skill asks the owner a question | The skill tells the owner in the session to write to the business number; after the owner writes, the skill asks again and the not-sent questions go out in one numbered message, and the owner's answers close them |

## Files
| Path | Create or change | Holds |
|---|---|---|
| skill/deputy/loop.md | Create | the round, step by step, with the tool names |
| skill/deputy/SKILL.md | Create (SPEC-05-7 creates it; this spec adds the link to loop.md) | one link line |
| test/skill/loop.test.ts | Create | reads loop.md and asserts the rows |

## Reuses
- Precedent: SPEC-05-7-skill.md, the skill file this spec links the loop from.
- Precedent: SPEC-05-5-setup-interview.md, a skill text checked by a test that reads it.

## Tests first
FR-SETUP-05-22: loop.md names check_messages, then list_pending, then read_knowledge, before any send step. FR-SETUP-05-23: it hands each pending chat to the triage helper, which sends only when the knowledge backs the question and its class is not in the always-ask list, and the dispatcher's own steps never name send_answer. FR-SETUP-05-24: it collects the one-line questions the helpers return and calls ask_owner once per round with all of them. FR-SETUP-05-25: it calls answer_question for each owner answer, then send_owner_go. FR-SETUP-05-26: on a refused send with a closed customer window it tells the owner in the session and does not retry. FR-SETUP-05-27: when the owner's own window is closed it tells the owner in the session to write to the business number, and after the owner writes it asks again so the not-sent questions go out in one numbered message. EX-10: loop.md lets the triage helper send an answer the knowledge backs when its class is not always-ask. EX-11: loop.md has the triage helper send nothing and return the question when its class is always-ask. EX-12: on a closed customer window loop.md says to tell the owner and not retry. EX-13: on a closed owner window loop.md says to tell the owner in the session to write to the business number, then to ask again after the owner writes, and that the owner's answers close the questions.

## Build
```ts
const loop = readFileSync("skill/deputy/loop.md", "utf8");
export const ROUND = ["check_messages", "list_pending", "read_knowledge"];
export const AFTER = ["deputy-triage", "ask_owner", "answer_question", "send_owner_go"];
```
The test asserts that each name of ROUND appears before the first name of AFTER, in the order given.

## Done when
`bun test test/skill/loop.test.ts`

## Out of scope
- Remembering a rule, the pilot's counts and the repeat every 30 to 60 minutes: SPEC-05-10. The first message at the end of setup: SPEC-05-11.
- The tools themselves: the Intake, Drafts and Knowledge pilot specs.

## Open questions
None. send_owner_go and pilot_stats are the names in the Drafts pilot specs; the dispatcher steps are SPEC-05-16.
