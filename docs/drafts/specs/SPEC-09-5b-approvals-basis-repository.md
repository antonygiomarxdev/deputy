# SPEC-09-5b: the approval repository reads and writes the basis

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

The approval repository reads and writes `basis` (depends on SPEC-09-5a).

Last change: 2026-11-24, after the lead's decision: approveWithoutWords replaces sendWithoutWords and the approval records its basis.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/sqlite-approval-repository.ts | Change | Reads and writes `basis` |
| test/drafts/contract/approval-repository.contract.ts | Change | Adds the basis read and write cases below |

## Reuses
- Precedent: SPEC-02-owners-go.md, which built the approval repository and its contract.

## Tests first
- FR-DRAFTS-02-14 (15): an approval appended with `basis: "owner_go"` reads back with that basis.
- FR-DRAFTS-02-14 (16): an approval appended without a basis reads back as 'owner_words'.

## Build
```ts
// sqlite-approval-repository.ts: the insert and the row mapper include basis
```

## Done when
`bun test test/drafts/contract`

## Out of scope
The column (SPEC-09-5a), the Draft method (SPEC-09-4).

## Open questions
None.
