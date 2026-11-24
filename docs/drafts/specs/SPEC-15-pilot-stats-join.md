# SPEC-15: pilot_stats joins the drafts counts with Intake's counts per day

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

`pilot_stats` returns one row per day that joins Drafts' `countsByDay` (SPEC-08) with Intake's `IntakeDailyCounts.between(from, to)` (Intake PR 212, which returns `{ day, customerMessages, ownerQuestions }`) by `day`: `{ day, customerMessages, ownerQuestions, autoAnswers, goAnswers, ownerApprovals }`. A day present on one side only gets zero on the other side. Merge order: PR 209 and PR 212 before PR 202.

Last change: 2026-11-24, the joined view split from SPEC-08 so each side has one owner.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers, the answers sent with an owner's go and the owner's hand approvals, and shall show the counts to the owner. (R-DRAFTS-24) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/pilot-stats-tool.ts | Create | `pilotStatsTool`: joins the two sources by `day` |
| src/main/tools.ts | Change | Registers `pilot_stats` in the MCP tool list |
| test/drafts/pilot-stats-tool.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-08-pilot-counts.md, whose `countsByDay` gives the Drafts side.
- Dependency: Intake PR 212's `IntakeDailyCounts.between(from, to)`, which gives the customer-message and owner-question side.

## Tests first
- FR-DRAFTS-04-12 (4): `pilotStatsTool` returns the joined row for a day present on both sides, with the values of both.
- FR-DRAFTS-04-12 (7): a day present only in Intake's counts has `autoAnswers`, `goAnswers` and `ownerApprovals` of 0.
- FR-DRAFTS-04-12 (8): a day present only in Drafts' counts has `customerMessages` and `ownerQuestions` of 0.

## Build
```ts
export type JoinedDay = { day: string; customerMessages: number; ownerQuestions: number; autoAnswers: number; goAnswers: number; ownerApprovals: number };
export function pilotStatsTool(d: { drafts: () => Promise<DailyCounts[]>; intake: () => Promise<{ day: string; customerMessages: number; ownerQuestions: number }[]> }): () => Promise<JoinedDay[]>;
```

## Done when
`bun test test/drafts/pilot-stats-tool.test.ts`

## Out of scope
The Drafts counts (SPEC-08), Intake's counts (Intake PR 212), and the send tools and the rest of the MCP list (SPEC-13).

## Open questions
None.
