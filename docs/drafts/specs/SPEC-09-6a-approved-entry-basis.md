# SPEC-09-6a: the approved event and log entry carry the basis

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

The `Approved` event and the approved log entry carry the approval's `basis`, so the log read shows it (R-DRAFTS-17). A missing basis means `owner_words`. Depends on SPEC-09-4 (the approval method).

Last change: 2026-11-24, after the review of 7a56758: the approved entry carries the basis; CheckApprovals runs on the real use case; the approval port gains approvalsBetween. Split so each run has at most 3 files.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner can check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval keeps empty owner words and basis automatic; Deputy reports it as automatic, not as an owner approval, and the log shows each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/events.ts | Change | `Approved` carries `basis?: ApprovalBasis`, missing = `owner_words` |
| src/drafts/domain/log-entry.ts | Change | `LogEntry` and `NewLogEntry` carry `basis` |
| src/drafts/domain/log-mapper.ts | Change | The approved entry takes `basis` from the `Approved` event |

## Reuses
- Precedent: SPEC-09-2-automatic-entry.md, which carries a field from an event into the entry in the same mapper.

## Tests first
- FR-DRAFTS-04-5 (10): given an `Approved` with basis `owner_go`, the approved entry has `basis: "owner_go"`.
- FR-DRAFTS-04-5 (11): given an `Approved` without a basis, the approved entry has `basis: "owner_words"`.

## Build
```ts
// events.ts: Approved gains basis?: ApprovalBasis
// log-entry.ts: LogEntry.basis?: ApprovalBasis; blankLogEntry defaults it to owner_words
```

## Done when
`bun test test/drafts/approved-entry-basis.test.ts`

## Out of scope
The column (SPEC-09-6b), the read and the audit (SPEC-09-6c).

## Open questions
None.
