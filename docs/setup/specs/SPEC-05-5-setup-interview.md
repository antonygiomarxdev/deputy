# SPEC-05-5: the setup interview the skill runs

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Write the setup part of the skill: the interview about the business, reading what the owner gives, confirming before saving, writing knowledge and the always-ask classes, and recording the owner's numbers after the owner confirms them.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-11 | WHEN | WHEN the connection works, the skill shall interview the owner about how the business works, its products and prices, its hours, and which questions must always be asked of the owner. |
| FR-SETUP-05-12 | WHEN | WHEN the owner gives a spreadsheet or documents, the agent shall read them and show what it understood before anything is saved. |
| FR-SETUP-05-13 | WHEN | WHEN the owner confirms what was understood, the skill shall write the knowledge through Knowledge's tools, including the always-ask classes (D38). |
| FR-SETUP-05-14 | WHEN | WHEN the owner states their own numbers, the skill shall repeat them back and, after the owner confirms in the conversation, record them through Intake's owner-numbers tool. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| skill/deputy/setup.md | Create | the interview steps and the confirm-before-save rule |
| test/skill/setup-interview.test.ts | Create | reads setup.md and asserts the rows |

## Reuses
- `src/intake/adapters/mcp/intake-tools.ts` `getOwnerNumbers`: the read tool the skill uses to repeat the recorded numbers back.

## Tests first
FR-SETUP-05-11: setup.md lists the interview topics (how the business works, products and prices, hours, always-ask questions). FR-SETUP-05-12: it tells the agent to show what it understood before saving. FR-SETUP-05-13: it tells the agent to write through the Knowledge tools only after the owner confirms. FR-SETUP-05-14: it tells the agent to repeat the owner numbers back and record them only after the owner confirms in the conversation.

## Build
```ts
const setup = readFileSync("skill/deputy/setup.md", "utf8");
export const TOPICS = ["how the business works", "products and prices", "hours", "always ask"];
```
setup.md has one heading per topic, then "Confirm before saving" and "Owner numbers".

## Done when
`bun test test/skill/setup-interview.test.ts`

## Out of scope
- The Knowledge write tools and the owner-numbers setter: their own specs in the Knowledge and Intake slices. Until they exist, setup.md names the tools by role.
- The daily loop: SPEC-05-7.

## Open questions
Q-1 (Lead): the names of the Knowledge write tool and the Intake owner-numbers tool, from the Knowledge and Intake pilot specs; fill them in setup.md before approval.
