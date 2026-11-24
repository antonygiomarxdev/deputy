# SPEC-10-3b: the in-memory drafts unit of work provides pendingGoes

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Provides `pendingGoes` in the in-memory drafts unit of work, with the same rollback as the SQLite one (depends on SPEC-10-3a).

Last change: 2026-11-24, split so each run has at most three files, test files included.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-15 | WHEN | When Deputy restarts, a go shall stay until one send uses it or a newer go for the same chat replaces it. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/memory/in-memory-drafts.ts | Change | The in-memory transaction provides `pendingGoes` over the in-memory store |
| test/drafts/unit-of-work-memory.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-10-3a-pending-goes-in-sqlite-uow.md, the same transaction member in the SQLite unit of work.

## Tests first
- FR-DRAFTS-02-15 (10): the in-memory unit of work gives the same result as the SQLite one for a `take` inside a failing `uow.run`: the go's `used_at` is null afterwards.

## Build
```ts
// in-memory-drafts.ts: the transaction object includes pendingGoes over the in-memory store
```

## Done when
`bun test test/drafts/unit-of-work-memory.test.ts`

## Out of scope
The port (SPEC-10-3a) and the send (SPEC-12).

## Open questions
None.
