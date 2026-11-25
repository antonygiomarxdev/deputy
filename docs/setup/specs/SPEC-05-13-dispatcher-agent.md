# SPEC-05-13: The dispatcher agent file

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

The agent definition the shortcut starts the session as: `deputy-dispatcher`. Its tool list is an allowlist that holds the pending list, the owner questions, the Knowledge and setup tools and the agent tool, and holds no web tool, no shell tool and no send-answer tool. Its text tells it never to block and to hand long work to a helper.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-37 | always | The main session shall never block: it checks messages, answers quick questions and asks the owner, and it hands long work to a background helper that reports back. (Owner decision of 2026-11-24, docs/adr/ADR-019.) |
| FR-SETUP-05-40 | always | The Deputy session shall have no internet access unless the owner asks. (Owner decision of 2026-11-24, docs/adr/ADR-019.) |
| FR-SETUP-05-48 | WHEN | WHEN the owner asks how much of the plan the pilot used, Deputy shall return, per day, per part (dispatcher, triage helper, web helper) and per model, the input, output, cache-creation and cache-read token counts. (Proposed, lead decision.) |
| FR-SETUP-05-47 | always | Helpers shall not ask the owner anything; only the dispatcher asks. (Proposed, lead decision.) |
| EX-16 | RULE-8 | positive | The owner asks to build the catalog from a long spreadsheet | The dispatcher runs | A background helper builds it and the dispatcher keeps answering messages |
| EX-17 | RULE-8 | negative | A customer asks something the knowledge does not cover | Nobody asked for research | The dispatcher does not search the web and asks the owner |

## Files
| Path | Create or change | Holds |
|---|---|---|
| skill/deputy/agents/deputy-dispatcher.md | Create | the agent file: frontmatter and instructions |
| test/skill/dispatcher-agent.test.ts | Create | reads the file and asserts the rows |

## Reuses
- Precedent: SPEC-05-7-skill.md, a skill file checked by a test that reads it
- Precedent: docs/adr/ADR-019-dispatcher-session-and-background-helpers.md, the decision this file carries out

## Tests first
FR-SETUP-05-37, FR-SETUP-05-40, FR-SETUP-05-47, FR-SETUP-05-48, EX-16, EX-17, written before the code, without it in view, by reading the file. FR-SETUP-05-40: the `tools` list holds no `WebSearch`, no `WebFetch`, no `Bash`, no `PowerShell` and no `mcp__deputy__send_answer`, and every name in it is a full name. FR-SETUP-05-37: the list holds `Agent` and the text says the dispatcher never waits for a helper and hands long work to one. EX-16: the text names the work that counts as long (the work the skill text calls long) and says to run a background helper for it. EX-17: the text says the web helper runs only when the owner asks. FR-SETUP-05-47: the text says only the dispatcher asks the owner, once per round. FR-SETUP-05-48: the list holds `mcp__deputy__token_stats`. The frontmatter has a `name` equal to the file name.

## Build
```ts
const agent = readFileSync("skill/deputy/agents/deputy-dispatcher.md", "utf8");
export const DISPATCHER_TOOLS = ["Agent", "mcp__deputy__check_messages", "mcp__deputy__list_pending", "mcp__deputy__token_stats", "mcp__deputy__ask_owner", "mcp__deputy__answer_question", "mcp__deputy__send_owner_go", "mcp__deputy__read_knowledge", "mcp__deputy__save_profile", "mcp__deputy__save_catalog", "mcp__deputy__save_always_ask", "mcp__deputy__remember"];
```
The setup tools, `set_owner_numbers` and `pilot_stats` that the skill rows already call are listed too. The exact list is the test's constant.

## Done when
`bun test test/skill/dispatcher-agent.test.ts`

## Out of scope
The helper files (SPEC-05-14); the install step that copies the file (SPEC-05-15); the loop text (SPEC-05-16).

## Open questions
None. The list adds to the lead's the tools the existing skill rows already call (`check_messages`, the setup tools, `set_owner_numbers`, `pilot_stats`); the lead decided that the dispatcher holds `send_owner_go` and has no `get_chat` (the owner decided that it sees only the pending list). How the dispatcher reads the owner's answers in the control chat without `get_chat` is not decided (see the open question of FRD-05). Proposed, lead decision.
