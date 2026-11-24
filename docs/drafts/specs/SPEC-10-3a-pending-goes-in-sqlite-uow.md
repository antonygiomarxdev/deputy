# SPEC-10-3a: the SQLite drafts unit of work provides pendingGoes

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Adds `pendingGoes` to the drafts `Transaction` (src/drafts/ports/store.ts) and provides it in the SQLite unit of work, so taking a go and approving its draft can run in one `uow.run` (SPEC-12). The in-memory unit of work is SPEC-10-3b. Depends on SPEC-10-2.

Last change: 2026-11-24, split so each run has at most three files, test files included.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-15 | WHEN | When Deputy restarts, a go shall stay until one send uses it or a newer go for the same chat replaces it. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/ports/store.ts | Change | `Transaction` gains `readonly pendingGoes: PendingGoStore` |
| src/drafts/adapters/sqlite/sqlite-unit-of-work.ts | Change | The SQLite transaction provides `pendingGoes` over its own executor |
| test/drafts/unit-of-work.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-02-owners-go.md, which added `approvals` to the same transaction the same way.

## Tests first
- FR-DRAFTS-02-15 (9): in the SQLite unit of work, a `take` inside `uow.run` that throws afterwards leaves the go's `used_at` null after the rollback.

## Build
```ts
export interface Transaction { /* existing fields */ readonly pendingGoes: PendingGoStore; }
```

## Done when
`bun test test/drafts/unit-of-work.test.ts`

## Out of scope
The in-memory unit of work (SPEC-10-3b), the go's logic (SPEC-07), and the send (SPEC-12).

## Open questions
None.
