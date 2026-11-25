# SPEC-05-17: The token usage of a transcript

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

A pure function that reads the lines of one transcript file and adds up, per day, per part and per model, the four token counts. It keeps only the usage, the model and the time of each entry, and its result holds no text, id or path. A line it does not understand makes the whole file unrecognized.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-48 | WHEN | WHEN the owner asks how much of the plan the pilot used, Deputy shall return, per day, per part (dispatcher, triage helper, web helper) and per model, the input, output, cache-creation and cache-read token counts. (Proposed, lead decision.) |
| FR-SETUP-05-49 | always | The token counts shall come only from the usage, the model and the time of each transcript entry, and the result shall hold no text, no id and no path. (Proposed, lead decision.) |
| EX-22 | RULE-10 | positive | The session and one triage helper ran today | The owner asks how much of the plan was used | Deputy returns today's four token counts for the dispatcher and for the triage helper, per model |
| EX-23 | RULE-10 | negative | A transcript entry holds a customer message | The counts are built | The result holds none of the message text, ids or paths |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/setup/domain/token-usage.ts | Create | `addUsage`, `UsageDay` |
| test/setup/unit/token-usage.test.ts | Create | the tests below |

## Reuses
- Nothing to reuse: the transcript format is undocumented, so the shape below follows what a transcript line holds today (docs/adr/ADR-019).

## Tests first
FR-SETUP-05-48, FR-SETUP-05-49, EX-22, EX-23, written before the code, without it in view, with lines made for the test. FR-SETUP-05-48: two entries of one model on one day add their four counts; two models on one day give two rows; two days give two rows, oldest first; the day is the local date of the entry's time. EX-22: entries of the session file count as part `dispatcher` and entries of a triage helper file as part `triage`. FR-SETUP-05-49 and EX-23: an entry that also holds message text, an id and a path gives a result with none of them (a search of the JSON of the result for each finds nothing); an entry with no usage adds nothing; a line that is not valid JSON makes the file unrecognized.

## Build
```ts
export type Part = "dispatcher" | "triage" | "web" | "helper";
export type UsageDay = { day: string; part: Part; model: string; input: number; output: number; cacheCreation: number; cacheRead: number };
export function addUsage(lines: string[], part: Part, zone: string): { kind: "usage"; days: UsageDay[] } | { kind: "unrecognized" };
```
The usage of an entry is read from its `message.usage` (the four counts), its `message.model` and its `timestamp`; nothing else is read.

## Done when
`bun test test/setup/unit/token-usage.test.ts`

## Out of scope
Finding the files (SPEC-05-18); the tool (SPEC-05-19).

## Open questions
None.
