# SPEC-09-6d: the in-memory drafts log stores the basis of approved entries

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The in-memory drafts log keeps `basis` on approved entries, the same as the SQLite log of SPEC-09-6b, so the contract holds for both (FR-DRAFTS-04-5). Depends on SPEC-09-6a (the field) and runs with the contract the SQLite log uses.

Last change: 2026-11-24, split from SPEC-09-6 so each run has at most 3 non-test files.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner can check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval keeps empty owner words and basis automatic; Deputy reports it as automatic, not as an owner approval, and the log shows each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/memory/in-memory-draft-log.ts | Change | Appends and reads `basis` on approved entries, default `owner_words` |

## Reuses
- Precedent: SPEC-09-6b-log-basis-column.md, the same field in the SQLite log.

## Tests first
- FR-DRAFTS-04-5 (15): an approved entry appended to the in-memory log with `basis: "owner_go"` reads back with that basis.
- FR-DRAFTS-04-5 (16): an approved entry appended without a basis reads back as `owner_words`.

## Build
```ts
// in-memory-draft-log.ts: the stored entry includes basis; a missing value reads as "owner_words"
```

## Done when
`bun test test/drafts/contract`

## Out of scope
The event and entry field (SPEC-09-6a), the SQLite column and trigger (SPEC-09-6b), and the CheckApprovals reads (SPEC-09-6c).

## Open questions
None.
