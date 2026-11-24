# SPEC-05-19: The token_stats tool

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

The `token_stats` tool: it calls the reader and the adding up and returns the days, or a plain sentence when the files are missing or in a format Deputy does not know. It returns the four counts per day, per part and per model, and nothing else.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-48 | WHEN | WHEN the owner asks how much of the plan the pilot used, Deputy shall return, per day, per part (dispatcher, triage helper, web helper) and per model, the input, output, cache-creation and cache-read token counts. (Proposed, lead decision.) |
| FR-SETUP-05-50 | IF | IF a transcript file is missing or its format is not the expected one, THEN Deputy shall say so and return no numbers for it. (Proposed, lead decision.) |
| EX-22 | RULE-10 | positive | The session and one triage helper ran today | The owner asks how much of the plan was used | Deputy returns today's four token counts for the dispatcher and for the triage helper, per model |
| EX-24 | RULE-10 | boundary | A transcript file has a format Deputy does not know | The owner asks for the counts | Deputy says the format is not recognized and returns no numbers for that file |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/setup/adapters/mcp/token-stats-tool.ts | Create | `tokenStatsTool` |
| src/main/tools.ts | Change | adds the tool to the list |
| test/setup/unit/token-stats-tool.test.ts | Create | the tests below |

## Reuses
- `src/main/tools.ts` `mcpServer`: where the tool lists are joined
- Precedent: SPEC-05-4-setup-tools.md, a small Setup tool that wraps a use case
- Precedent: SPEC-05-17-token-usage.md and SPEC-05-18-transcript-reader.md, what the tool calls

## Tests first
FR-SETUP-05-48, FR-SETUP-05-50, EX-22, EX-24, written before the code, without it in view, with a fake reader. FR-SETUP-05-48: with two days of usage the tool returns the days with `day`, `part`, `model` and the four counts, and its text says the format is not documented by the agent's maker. EX-22: the parts `dispatcher` and `triage` both appear. FR-SETUP-05-50: a missing folder gives a plain sentence and no numbers; an unrecognized file adds a line saying how many files had a format Deputy does not know; the tool takes no input and is in the tool list.

## Build
```ts
export function tokenStatsTool(d: { reader: TranscriptReader; zone: string }): ToolDefinition; // no input; output { days: UsageDay[]; unrecognized: number }
```

## Done when
`bun test test/setup/unit/token-stats-tool.test.ts`

## Out of scope
Joining these counts with the pilot's answer counts (Drafts SPEC-15).

## Open questions
None.
