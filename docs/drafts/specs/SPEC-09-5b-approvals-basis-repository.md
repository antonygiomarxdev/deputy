# SPEC-09-5b: the approval stores read and write the basis, and list approvals by time

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

The approval repositories (SQLite and in-memory) read and write `basis`, and add `approvalsBetween` for SPEC-08's hand-approval count (depends on SPEC-09-5a).

Last change: 2026-11-24, after the review of a17110b: the audit is the approval row; approveWithoutWords skips the shown and text checks; approvals carry an optional basis; counts read approvals; CheckApprovals reports automatic.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/sqlite-approval-repository.ts | Change | Reads and writes `basis`; adds `approvalsBetween` |
| src/drafts/adapters/memory/in-memory-approvals.ts | Change | The same read, write and `approvalsBetween` in memory |
| test/drafts/contract/approval-repository.contract.ts | Change | Adds the cases below to the repository contract |

## Reuses
- Precedent: SPEC-02-owners-go.md, which built the approval repositories and their contract.

## Tests first
- FR-DRAFTS-02-14 (15): an approval appended with `basis: "owner_go"` reads back with that basis.
- FR-DRAFTS-02-14 (16): an approval appended without a basis reads back as `owner_words`.
- FR-DRAFTS-02-14 (17): `approvalsBetween` returns the approvals in the range with their `approvedAt` and `basis`, and no others.

## Build
```ts
export type ApprovalBasis = "owner_words" | "automatic" | "owner_go";
// both repositories
approvalsBetween(fromMs: number, toMs: number): Promise<{ approvedAt: number; basis: ApprovalBasis }[]>;
```

## Done when
`bun test test/drafts/contract`

## Out of scope
The column (SPEC-09-5a), the Draft method (SPEC-09-4), and the count that reads it (SPEC-08).

## Open questions
None.
