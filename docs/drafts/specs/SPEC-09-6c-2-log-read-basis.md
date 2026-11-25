# SPEC-09-6c-2: the drafts log read shows the basis of approved and sent entries

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The drafts log read shows the basis of each approved and sent entry, so an owner_go send is verifiable (PRODUCT section 8, criterion 2) (depends on SPEC-09-6b-2).

Last change: 2026-11-24, split so each run has at most three files, test files included.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner shall be able to check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval shall keep empty owner words and basis automatic; Deputy shall report it as automatic, not as an owner approval, and the log shall show each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/read-draft-log.ts | Change | Each approved and sent entry in the read shows its basis |
| test/drafts/read-draft-log-basis.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-04-drafts-log.md Task 3, which built the log read.

## Tests first
- FR-DRAFTS-04-5 (9): given an owner_go send, the log read shows its approved entry with basis `owner_go` and its sent entry with `automatic` false.

## Build
```ts
// read-draft-log.ts: each approved and sent entry carries basis in the read result
```

## Done when
`bun test test/drafts/read-draft-log-basis.test.ts`

## Out of scope
The audit reads (SPEC-09-6c-1).

## Open questions
None.
