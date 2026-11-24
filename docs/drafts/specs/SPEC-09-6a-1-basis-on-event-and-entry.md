# SPEC-09-6a-1: the approved event and the log entry carry the basis

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

`Approved` carries an optional `basis`, and `LogEntry.basis` is optional too; `blankLogEntry` defaults it to `owner_words`. A missing basis means `owner_words` (R-DRAFTS-17). Depends on SPEC-09-4.

Last change: 2026-11-24, split so each run has at most three files, test files included.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner can check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval keeps empty owner words and basis automatic; Deputy reports it as automatic, not as an owner approval, and the log shows each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/events.ts | Change | `Approved` carries `basis?: ApprovalBasis`, missing = `owner_words` |
| src/drafts/domain/log-entry.ts | Change | `LogEntry.basis?: ApprovalBasis`; `blankLogEntry` defaults it to `owner_words` |
| test/drafts/log-entry-basis.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-09-2-automatic-entry.md, which adds one optional field to the same entry.

## Tests first
- FR-DRAFTS-04-5 (10): an `Approved` event with basis `owner_go` carries that basis.
- FR-DRAFTS-04-5 (11): an `Approved` event without a basis carries `owner_words`.
- FR-DRAFTS-04-5 (12): `blankLogEntry` has `basis` `owner_words`.

## Build
```ts
// events.ts: Approved gains basis?: ApprovalBasis
// log-entry.ts: LogEntry.basis?: ApprovalBasis; blankLogEntry defaults it to owner_words
```

## Done when
`bun test test/drafts/log-entry-basis.test.ts`

## Out of scope
The mapper (SPEC-09-6a-2), the column (SPEC-09-6b-1, 09-6b-2), and the reads (SPEC-09-6c-1, 09-6c-2).

## Open questions
None.
