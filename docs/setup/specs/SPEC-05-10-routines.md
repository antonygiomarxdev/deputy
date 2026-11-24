# SPEC-05-10: remember, the pilot's counts and the repeat

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Write routines.md: saving a rule with the owner's own words, reporting the pilot's counts, and the recipe that repeats a round of the daily loop every 30 to 60 minutes. loop.md links it.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-28 | WHEN | WHEN the owner states a rule to keep, in the control chat or in the session, the skill shall save it with the owner's own words. |
| FR-SETUP-05-29 | WHEN | WHEN the owner asks how the pilot is going, the skill shall report the pilot's counts. |
| FR-SETUP-05-30 | WHILE | WHILE the session is open, the skill shall run one round of the daily loop now and again every 30 to 60 minutes (D34, ADR-018). |
| FR-SETUP-05-35 | IF | IF a Deputy tool reports an error, such as a refused key, a failing check for messages or a failed send, THEN the skill shall tell the owner in plain words, by message first and in the session when the owner's window is closed. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| skill/deputy/routines.md | Create | remember, counts and the repeat recipe |
| skill/deputy/loop.md | Create (SPEC-05-9 creates it; this spec adds the link to routines.md) | one link line |
| test/skill/routines.test.ts | Create | reads routines.md and asserts the rows |

## Reuses
- Precedent: SPEC-05-9-daily-loop.md, the loop text this spec links from.
- `docs/adr/ADR-018-wake-and-permissions.md` `/loop`: the repeat that backs up the channel notice.

## Tests first
FR-SETUP-05-28: routines.md tells the skill to call remember with the owner's own words, and with the message id when the rule came from the control chat. FR-SETUP-05-29: it tells the skill to call pilot_stats and report the counts it returns. FR-SETUP-05-30: it gives the repeat: the skill starts a loop of 30 to 60 minutes that runs one round of loop.md when the skill loads, and it says that if the loop stops after the context is compacted, the owner types the skill's command again. FR-SETUP-05-35: routines.md tells the skill to say in plain words when a tool reports an error (a refused key, a failing check for messages, a failed send), by message first and in the session when the owner's window is closed.

## Build
```ts
const routines = readFileSync("skill/deputy/routines.md", "utf8");
export const REPEAT = { minMinutes: 30, maxMinutes: 60 };
```
routines.md has three headings: Remember, Counts, Repeat.

## Done when
`bun test test/skill/routines.test.ts`

## Out of scope
- The loop steps themselves: SPEC-05-9. Whether the repeat survives compaction: unverified, checked by the pilot (ADR-018).

## Open questions
None.
