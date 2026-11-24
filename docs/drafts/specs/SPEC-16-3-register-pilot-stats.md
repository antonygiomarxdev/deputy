# SPEC-16-3: Register pilot_stats with its two sources

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The tool list gets `pilot_stats`: `pilotStatsTool` (SPEC-15) joined from Drafts' counts per day and Intake's `IntakeDailyCounts`, over the range and time zone this spec fixes. Third of four runs.

Last change: 2026-11-24, first draft for the Drafts pilot wiring.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows

| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers, the answers sent with an owner's go and the owner's hand approvals, and shall show the counts to the owner. (R-DRAFTS-24) |

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
FR-DRAFTS-04-12, in `test/main/pilot-stats-wiring.test.ts`, written without the code in view; it calls `mcpServer` with fake sources. Cases: the tool list holds `pilot_stats`; a call returns one row per day with `customerMessages`, `ownerQuestions`, `autoAnswers`, `goAnswers` and `ownerApprovals`, joined by day from the two sources; a day on one side only has zeros on the other; the call asks both sources for the same range, ending at the clock's now and starting 30 days before it; the call reads, and changes no state.

## Build
```ts
// in mcpServer, with pilot.stats from SPEC-16-1:
pilotStatsTool({ drafts: pilot.stats.drafts, intake: pilot.stats.intake }) // registered as "pilot_stats"
```
`pilot.stats.drafts` and `pilot.stats.intake` close over the range: from 30 days before now to now, days in the time zone the Intake counts use.

## Done when
`bun test test/main/pilot-stats-wiring.test.ts`

## Out of scope
The join itself (SPEC-15) and the counting (SPEC-08).

## Open questions
- Q-1 (Lead): the range of `pilot_stats` is not in any FRD row or earlier spec; 30 days ending now is proposed here for the pilot of the owner and one friend. Confirm or give another range.
