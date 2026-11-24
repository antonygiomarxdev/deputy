# SPEC-05-11: the owner's first message at the end of setup

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Add the last step of setup.md: the skill asks the owner to send one message from their personal number to the business number and checks that it arrived in the control chat. Setup is not finished until it has.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-31 | WHEN | WHEN the interview and the owner numbers are done, the skill shall ask the owner to send one message from their personal number to the business number, and shall check that it arrived in the control chat. (Proposed, lead decision.) |
| FR-SETUP-05-32 | IF | IF the first message has not arrived when the skill checks, THEN the skill shall tell the owner that it has not arrived and what to check, and shall not report setup as finished. (Proposed, lead decision.) |
| EX-14 | RULE-7 | positive | The owner sent the first message | The skill checks | The message is in the control chat and setup is reported as finished |
| EX-15 | RULE-7 | negative | The owner has not written yet | The skill checks | The skill says it has not arrived and setup is not reported as finished |

## Files
| Path | Create or change | Holds |
|---|---|---|
| skill/deputy/setup.md | Create (SPEC-05-5 creates it; this spec adds the last step) | the first-message step |
| test/skill/first-message.test.ts | Create | reads setup.md and asserts the rows |

## Reuses
- Precedent: SPEC-05-5-setup-interview.md, the setup text this spec adds a step to.

## Tests first
FR-SETUP-05-31: the last step of setup.md asks the owner to send one message from their personal number to the business number and tells the skill to read the control chat with get_chat to check that it arrived. FR-SETUP-05-32: when it has not arrived, the step tells the skill to say so, to name what to check (the owner number typed right and the business number), and never to report setup as finished. EX-14: the last step of setup.md reports setup finished only after the first message is found in the control chat. EX-15: when nothing arrived, the last step says so and does not report setup as finished.

## Build
```ts
const setup = readFileSync("skill/deputy/setup.md", "utf8");
export const LAST_STEP = "First message";
```
The test finds the heading LAST_STEP, asserts it is the last heading of setup.md, and reads its body.

## Done when
`bun test test/skill/first-message.test.ts`

## Out of scope
- Recognizing the control chat and its window: the Intake pilot specs. The interview steps before it: SPEC-05-5.

## Open questions
None.
