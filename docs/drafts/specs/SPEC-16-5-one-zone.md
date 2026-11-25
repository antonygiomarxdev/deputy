# SPEC-16-5: Read the time zone once and give it to both wirings

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

`serve.ts` reads the local time zone once, with `Intl.DateTimeFormat().resolvedOptions().timeZone`, and passes that one value to `intakeWiring` (the counts adapter of Intake SPEC-05-14) and to `draftsWiring` (the range of SPEC-08 and the per-day counts), so the two sides of `pilot_stats` group days the same way (L14, L16). Fifth of five runs.

Last change: 2026-11-24, first draft: SPEC-16-4's calls did not pass the zone.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-drafts-log.md

| FR-DRAFTS-04-13 | WHEN | When the session asks for the pilot counts with a number of days, Deputy shall return the counts for that many local days ending today, from 1 to 30 days with 7 when no number is given, and shall refuse any other number. (R-DRAFTS-24. Owner decision L16.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/serve.ts` | Change | Reads the zone once and passes it to `intakeWiring` and `draftsWiring` |
| `test/e2e/pilot-zone.test.ts` | Create | The end-to-end case below |

## Reuses
- `src/main/serve.ts` `serve`: the start sequence, top to bottom (ADR-013)
- Precedent: SPEC-16-4-start-order.md, which fixes the order of the calls this run completes
- Precedent: SPEC-08-pilot-counts.md, whose `localDayRange` and `countsByDay` take the zone

## Tests first
FR-DRAFTS-04-13, in `test/e2e/pilot-zone.test.ts`, written without the code in view, with the server over standard input and output on temporary folders and the dev provider, started with the environment variable TZ set to `Pacific/Kiritimati` (UTC+14, so its local date differs from the UTC date for most of the day). A customer message is delivered, one question is asked to an owner number and one automatic answer is sent; `pilot_stats` with no `days` returns one row, not two, whose `day` is the local date of the moment of the test in that zone (the test computes it with the same zone), and that row holds the customer message and the owner question from Intake and the automatic answer from Drafts. Both sides therefore grouped days with the same zone. The server reads the zone once: a second call of `Intl.DateTimeFormat().resolvedOptions().timeZone` is not made by either wiring.

## Build
```ts
// serve.ts, near the top of serve():
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const wired = intakeWiring({ ..., zone });                 // Intake SPEC-05-19: the counts adapter groups days in zone
const { drafts, approvals, pilot } = await draftsWiring({ ..., zone });   // SPEC-16-1: localDayRange and countsByDay take it
```

## Done when
`bun test test/e2e/pilot-zone.test.ts`

## Out of scope
The range function and the counts (SPEC-08), the counts adapter (Intake SPEC-05-14 and SPEC-05-19), the registration of `pilot_stats` (SPEC-16-3) and the other start order calls (SPEC-16-4).

## Open questions
None.
