# SPEC-09-5b-1: the approval port reads the basis and lists approvals by time

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

The `ApprovalRepository` port and the in-memory approvals read and write `basis`, and add `approvalsBetween` for SPEC-08's hand-approval count (depends on SPEC-09-5a). The SQLite store is SPEC-09-5b-2.

Last change: 2026-11-24, after the review of 7a56758: the approved entry carries the basis; CheckApprovals runs on the real use case; the approval port gains approvalsBetween. Split so each run has at most 3 files.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/ports/store.ts | Change | `ApprovalRepository` gains `approvalsBetween(fromMs, toMs)`; its append and read carry `basis` |
| src/drafts/adapters/memory/in-memory-approvals.ts | Change | The in-memory repository reads, writes and lists `basis` and `approvalsBetween` |
| test/drafts/contract/approval-repository.contract.ts | Change | Adds the cases below to the repository contract |

## Reuses
- Precedent: SPEC-02-owners-go.md, which built the approval port and its contract.

## Tests first
- FR-DRAFTS-02-14 (15): an approval appended with `basis: "owner_go"` reads back with that basis.
- FR-DRAFTS-02-14 (16): an approval appended without a basis reads back as `owner_words`.
- FR-DRAFTS-02-14 (17): `approvalsBetween` returns the approvals in the range with their `approvedAt` and `basis`, and no others.

## Build
```ts
export type ApprovalBasis = "owner_words" | "automatic" | "owner_go";
// ApprovalRepository
approvalsBetween(fromMs: number, toMs: number): Promise<{ approvedAt: number; basis: ApprovalBasis }[]>;
```

## Done when
`bun test test/drafts/contract`

## Out of scope
The SQLite repository (SPEC-09-5b-2), the column (SPEC-09-5a), and the count that reads it (SPEC-08).

## Open questions
None.
