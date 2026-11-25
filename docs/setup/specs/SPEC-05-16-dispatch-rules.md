# SPEC-05-16: The skill's dispatch rules

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

The skill text that makes the main session a dispatcher: what counts as long work and goes to a background helper, that a web request starts the web helper for that request, and that each round collects the results of finished helpers. The loop of SPEC-05-9 hands each pending chat to the triage helper.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-37 | always | The main session shall never block: it checks messages, answers quick questions and asks the owner, and it hands long work to a background helper that reports back. (Owner decision of 2026-11-24, docs/adr/ADR-019.) |
| FR-SETUP-05-38 | always | Work shall count as long when it reads a spreadsheet or documents, builds or changes the catalog, searches the web or summarizes many chats; one read of one chat and one question to the owner are not long. (Proposed, lead decision.) |
| FR-SETUP-05-41 | WHEN | WHEN the owner asks for a web lookup or research, the dispatcher shall run the web helper for that request only and show its result to the owner, with no terminal prompt. (Proposed, lead decision.) |
| FR-SETUP-05-46 | WHEN | WHEN a round of the daily loop runs, the dispatcher shall also collect the results of the helpers that finished. (Proposed, lead decision.) |
| EX-16 | RULE-8 | positive | The owner asks to build the catalog from a long spreadsheet | The dispatcher runs | A background helper builds it and the dispatcher keeps answering messages |
| EX-18 | RULE-8 | boundary | The owner asks in a message to look something up online | The dispatcher runs | The web helper runs for that request only and its result is shown to the owner |

## Files
| Path | Create or change | Holds |
|---|---|---|
| skill/deputy/loop.md | Create (SPEC-05-9 creates it; this spec adds the steps) | the dispatch steps and the helper results step |
| skill/deputy/SKILL.md | Create (SPEC-05-7 creates it; this spec adds the rule) | the rule that long work and web work go to helpers |
| test/skill/dispatch.test.ts | Create | reads both files and asserts the rows |

## Reuses
- Precedent: SPEC-05-9-daily-loop.md, the loop file this spec extends
- Precedent: SPEC-05-13-dispatcher-agent.md, the agent text these rules match

## Tests first
FR-SETUP-05-37, FR-SETUP-05-38, FR-SETUP-05-41, FR-SETUP-05-46, EX-16, EX-18, written before the code, without it in view, by reading the two files. FR-SETUP-05-37: SKILL.md says the main session never waits for a helper. FR-SETUP-05-38: it names the work that is long (a spreadsheet or documents, the catalog, a web search, many chats) and says one read or one question is not. EX-16: loop.md has a step that starts a background helper for long work and returns to the round. FR-SETUP-05-41 and EX-18: loop.md says that when the owner asks for a web lookup the dispatcher runs `deputy-web` for that request and shows the result. FR-SETUP-05-46: loop.md has a step that collects the results of finished helpers, after the round's reads and before the questions to the owner.

## Build
```ts
const loop = readFileSync("skill/deputy/loop.md", "utf8");
export const HELPER_STEPS = ["deputy-triage", "collect the results", "deputy-web"];
```
The test asserts that the names appear in loop.md and that `collect the results` comes before `ask_owner`.

## Done when
`bun test test/skill/dispatch.test.ts`

## Out of scope
The agent files (SPEC-05-13, SPEC-05-14); whether a finished helper wakes an idle session (unverified, ADR-018 and docs/adr/ADR-019).

## Open questions
None.
