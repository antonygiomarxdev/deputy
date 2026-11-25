# SPEC-09-6a-2: the mapper copies the basis into the approved entry

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The mapper sets the approved log entry's `basis` from the `Approved` event, with `owner_words` when the event has none (depends on SPEC-09-6a-1).

Last change: 2026-11-24, split so each run has at most three files, test files included.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner shall be able to check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval shall keep empty owner words and basis automatic; Deputy shall report it as automatic, not as an owner approval, and the log shall show each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/log-mapper.ts | Change | The approved entry takes `basis` from the `Approved` event, default `owner_words` |
| test/drafts/approved-entry-basis.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-09-2-automatic-entry.md, which copies a field from the event into the entry in the same mapper.

## Tests first
- FR-DRAFTS-04-5 (13): the mapper's approved entry has the basis of its `Approved` event, `owner_go` included.
- FR-DRAFTS-04-5 (14): an `Approved` event without a basis maps to an approved entry with `owner_words`.

## Build
```ts
// log-mapper.ts: approved entry basis = event.basis ?? "owner_words"
```

## Done when
`bun test test/drafts/approved-entry-basis.test.ts`

## Out of scope
The event and entry fields (SPEC-09-6a-1) and the columns (SPEC-09-6b-1, 09-6b-2).

## Open questions
None.
