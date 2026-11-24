# SPEC-09-5c: the SQLite approval repository reads and writes the basis

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

The SQLite approval repository reads, writes and lists `basis` and `approvalsBetween` through the port of SPEC-09-5b, and runs the same contract (depends on SPEC-09-5b).

Last change: 2026-11-24, after the review of 7a56758: the approved entry carries the basis; CheckApprovals runs on the real use case; the approval port gains approvalsBetween. Split so each run has at most 3 files.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/sqlite-approval-repository.ts | Change | Reads and writes `basis`; implements `approvalsBetween` |

## Reuses
- Precedent: SPEC-09-5b-approvals-port.md, the port and contract this adapter implements.

## Tests first
- FR-DRAFTS-02-14 (15): the SQLite repository passes case (15) of the contract.
- FR-DRAFTS-02-14 (16): the SQLite repository passes case (16) of the contract.
- FR-DRAFTS-02-14 (17): the SQLite repository passes case (17) of the contract.

## Build
```ts
// sqlite-approval-repository.ts: the insert and the row mapper include basis (NULL reads as owner_words); approvalsBetween queries approved_at in the range
```

## Done when
`bun test test/drafts/contract/approval-repository.sqlite.test.ts`

## Out of scope
The port and the in-memory store (SPEC-09-5b).

## Open questions
None.
