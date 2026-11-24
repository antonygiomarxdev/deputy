# SPEC-16-3: Register pilot_stats with its two sources

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The tool list gets `pilot_stats`: `pilotStatsTool` (SPEC-15) joined from Drafts' counts per day and Intake's `IntakeDailyCounts`; it takes an optional `days` (1 to 30, 7 by default) and covers that many local days ending today (lead decision L16, Proposed). Third of four runs.

Last change: 2026-11-24, first draft for the Drafts pilot wiring.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows

| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers, the answers sent with an owner's go and the owner's hand approvals, and shall show the counts to the owner. (R-DRAFTS-24) |
| FR-DRAFTS-04-13 | WHEN | When the session asks for the pilot counts with a number of days, Deputy shall return the counts for that many local days ending today, from 1 to 30 days with 7 when no number is given, and shall refuse any other number. (R-DRAFTS-24. Proposed, lead decision L16.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/tools.ts` | Change | Registers `pilot_stats` from `pilotStatsTool` |
| `test/main/pilot-stats-wiring.test.ts` | Create | The composition test below |

## Reuses
- `src/main/tools.ts` `mcpServer`: the place where the tool list is assembled
- Precedent: SPEC-15-pilot-stats-join.md, which builds `pilotStatsTool`
- Precedent: SPEC-16-1-pilot-dependencies.md, whose `stats` sources this run registers

## Tests first
FR-DRAFTS-04-12, FR-DRAFTS-04-13, in `test/main/pilot-stats-wiring.test.ts`, written without the code in view; it calls `mcpServer` with fake sources. Cases: the tool list holds `pilot_stats`; a call returns one row per day with `customerMessages`, `ownerQuestions`, `autoAnswers`, `goAnswers` and `ownerApprovals`, joined by day from the two sources; a day on one side only has zeros on the other; a call without `days` asks both sources for the last 7 local days ending today, with `days` 1 for today only and `days` 30 for the last 30 (FR-DRAFTS-04-13); both sources get the same range, from the start of the local day `days - 1` days ago to now, in the local time zone of the computer; `days` 0, 31, -1 and 2.5 are refused with `days_out_of_range` and neither source is read; the call reads, and changes no state.

## Build
```ts
// in mcpServer, with pilot.stats from SPEC-16-1:
pilotStatsTool({ drafts: () => pilot.stats.drafts(days), intake: () => pilot.stats.intake(days) }) // registered as "pilot_stats", input { days?: number }
```
The tool's input is `{ days?: number }` (a whole number from 1 to 30, default 7); the handler calls `pilot.stats.drafts(days)` and `pilot.stats.intake(days)`, which compute the range with `localDayRange` (SPEC-08) in the local time zone of the computer, and hands both to `pilotStatsTool`. The day is the local date of the computer, as Intake's counts use it (L14).

## Done when
`bun test test/main/pilot-stats-wiring.test.ts`

## Out of scope
The join itself (SPEC-15) and the counting (SPEC-08).

## Open questions
None.
