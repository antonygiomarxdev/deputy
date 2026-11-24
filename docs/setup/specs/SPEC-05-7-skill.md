# SPEC-05-7: the skill the owner loads with one command

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Write SKILL.md, the skill the owner loads by typing one command: it pre-allows only Deputy's tools, never asks for a terminal permission, asks by message first, reminds the owner to write once a day, gives the keep-awake checklist and carries Spanish and English copy.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-17 | WHEN | WHEN setup finishes, the skill shall give the owner the checklist (lid open, plugged in, no shutdown, network on) and say that a closed lid still sleeps the computer. |
| FR-SETUP-05-18 | WHEN | WHEN a day passes without a message from the owner to the business number, the skill shall remind the owner to send one (D36; the skill's reminder is in addition to the guide). |
| FR-SETUP-05-19 | WHEN | WHEN the owner types the skill's command, the skill shall load the setup and daily-use instructions without any permission prompt. |
| FR-SETUP-05-20 | always | The skill shall never ask the owner for a permission in the terminal during the daily loop (D35); when it needs the owner's decision it shall ask by message first and wait. |
| FR-SETUP-05-21 | always | The skill shall answer in the owner's language (D20); Spanish and English are the pilot's two languages. |
| EX-6 | RULE-3 | positive | Setup is done and the daily loop runs | The owner types the skill's command | The skill loads with no permission prompt |
| EX-7 | RULE-3 | negative | The daily loop needs the owner's decision | The owner is away from the terminal | The skill asks by message and does not open a terminal prompt |

## Files
| Path | Create or change | Holds |
|---|---|---|
| skill/deputy/SKILL.md | Create | frontmatter, daily loop, rules, checklist, reminder, both languages |
| test/skill/skill.test.ts | Create | reads SKILL.md and asserts the rows |

## Reuses
- `docs/adr/ADR-018-wake-and-permissions.md` `allowed-tools`: the second permission layer the skill declares.
- Precedent: SPEC-05-5-setup-interview.md, the setup part this skill links to.

## Tests first
FR-SETUP-05-17: SKILL.md holds the four checklist items and the closed-lid warning. FR-SETUP-05-18: it tells the skill to remind the owner when a day passes without a message to the business number. FR-SETUP-05-19: the frontmatter declares only Deputy's tools. FR-SETUP-05-20: it forbids asking for a permission in the terminal and says to ask by message first and wait. FR-SETUP-05-21: it carries both a Spanish and an English version of the owner-facing text and tells the skill to answer in the owner's language. EX-6: the skill's frontmatter declares only Deputy's tools, so typing its command raises no permission prompt. EX-7: when the daily loop needs the owner's decision, the skill text says to ask by message and never in the terminal.

## Build
```ts
const skill = readFileSync("skill/deputy/SKILL.md", "utf8");
export const FRONTMATTER = { name: "deputy", "allowed-tools": "mcp__deputy__*" };
```
SKILL.md sections: Daily loop, Rules (no terminal prompt, ask by message), Setup (links setup.md), Checklist, Daily reminder, Copy (Spanish and English).

## Done when
`bun test test/skill/skill.test.ts`

## Out of scope
- The loop steps: SPEC-05-9; remember, counts and the repeat: SPEC-05-10; the first message: SPEC-05-11. Errors: SPEC-05-10. The wake decision: ADR-018. Draft and send rules in the skill: the Drafts pilot specs.

## Open questions
None.
