# SPEC-05-14: The triage and web helper agent files

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

The two helper definitions: `deputy-triage` (a cheap model, a refusal instead of a prompt, no project instructions, and only `chat_context`, `read_knowledge` and `send_answer`) and `deputy-web` (the read tools plus WebSearch and WebFetch, a refusal instead of a prompt). Neither has an inline server entry or an empty tool set.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-39 | WHEN | WHEN a round lists pending chats, the dispatcher shall hand each chat, with its token, to a triage helper that runs in the background and reads the knowledge itself. (Proposed, lead decision.) |
| FR-SETUP-05-41 | WHEN | WHEN the owner asks for a web lookup or research, the dispatcher shall run the web helper for that request only and show its result to the owner, with no terminal prompt. (Proposed, lead decision.) |
| FR-SETUP-05-42 | always | No helper shall raise a permission prompt in the daily loop; a call that is not allowed is refused, not asked (FR-SETUP-05-20). (Proposed, lead decision.) |
| FR-SETUP-05-47 | always | Helpers shall not ask the owner anything; only the dispatcher asks. (Proposed, lead decision.) |
| EX-18 | RULE-8 | boundary | The owner asks in a message to look something up online | The dispatcher runs | The web helper runs for that request only and its result is shown to the owner |
| EX-19 | RULE-9 | positive | Three chats are pending | A round runs | Three triage helpers each hold one chat's token and the one with an answer sends it |
| EX-20 | RULE-9 | negative | A triage helper needs the owner's decision | It cannot ask the owner | It returns one line to the dispatcher |
| EX-21 | RULE-9 | boundary | The tool refused a triage helper's token | The helper reads the refusal | The helper stops, reports it and does not try another chat |

## Files
| Path | Create or change | Holds |
|---|---|---|
| skill/deputy/agents/deputy-triage.md | Create | the triage helper |
| skill/deputy/agents/deputy-web.md | Create | the web helper |
| test/skill/helper-agents.test.ts | Create | reads both files and asserts the rows |

## Reuses
- Precedent: SPEC-05-13-dispatcher-agent.md, the dispatcher file these helpers answer to
- Precedent: docs/adr/ADR-019-dispatcher-session-and-background-helpers.md, the decision this file carries out

## Tests first
FR-SETUP-05-39, FR-SETUP-05-41, FR-SETUP-05-42, FR-SETUP-05-47, EX-18, EX-19, EX-20, EX-21, written before the code, without it in view, by reading both files. FR-SETUP-05-39: the triage file has `model: haiku`, `omitClaudeMd: true`, and a `tools` list of exactly `mcp__deputy__chat_context`, `mcp__deputy__read_knowledge` and `mcp__deputy__send_answer`; its text says the dispatcher passes the chat id and the token, that the helper reads the knowledge itself with `read_knowledge`, and that it sends only when the knowledge backs the answer and the class is not always-ask, otherwise it returns one line with the question. FR-SETUP-05-42: both files have `permissionMode: dontAsk`; neither has a `mcpServers` key; neither has an empty `tools` list. EX-19: the triage text says it works on the one chat it was given. EX-20 and FR-SETUP-05-47: neither text lets the helper ask the owner; the triage text says to return one line. EX-21: the triage text says a refused token means stop and report. FR-SETUP-05-41 and EX-18: the web file lists `WebSearch` and `WebFetch` and no `send_answer`, no `ask_owner` and no chat tool (`get_chat`, `chat_context`), and its text says it gets only what the dispatcher puts in its prompt, runs for one request and returns the result.

## Build
```ts
export const TRIAGE_TOOLS = ["mcp__deputy__chat_context", "mcp__deputy__read_knowledge", "mcp__deputy__send_answer"];
export const WEB_TOOLS = ["mcp__deputy__read_knowledge", "WebSearch", "WebFetch"];
```
Both files start with a frontmatter block (`name`, `description`, `model`, `permissionMode`, `tools`); `omitClaudeMd` only in the triage file.

## Done when
`bun test test/skill/helper-agents.test.ts`

## Out of scope
The tools themselves and their token check: Intake SPEC-05-23 for `chat_context`, Intake SPEC-05-24 for `save_chat_summary`, Drafts SPEC-18 for `send_answer`; the install step (SPEC-05-15).

## Open questions
None. The web helper's tools (`read_knowledge` and the two web tools, no chat tool) and its default model are Proposed, lead decision.
