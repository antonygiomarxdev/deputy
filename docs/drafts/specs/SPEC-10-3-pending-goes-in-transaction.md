# SPEC-10-3: the pending go is part of the drafts transaction

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Adds `pendingGoes` to the drafts `Transaction` (src/drafts/ports/store.ts), so taking a go and approving its draft can run in one `uow.run`: the go is used only when its approval exists (SPEC-12). Both units of work provide it: the SQLite one and the in-memory one (`InMemoryDrafts`). Depends on SPEC-10-2 (the store).

Last change: 2026-11-24, added after review: SPEC-12 needs the go in the same transaction.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-15 | WHEN | When Deputy restarts, a go shall stay until one send uses it or a newer go for the same chat replaces it. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/ports/store.ts | Change | `Transaction` gains `readonly pendingGoes: PendingGoStore` |
| src/drafts/adapters/sqlite/sqlite-unit-of-work.ts | Change | The SQLite transaction provides `pendingGoes` over its own executor |
| src/drafts/adapters/memory/in-memory-drafts.ts | Change | The in-memory transaction provides `pendingGoes` over the in-memory store |

## Reuses
- Precedent: SPEC-10-2-pending-go-store.md, the store that both transactions now expose.
- Precedent: SPEC-02-owners-go.md, which added `approvals` to the same transaction the same way.

## Tests first
- FR-DRAFTS-02-15 (9): in the SQLite unit of work, a `take` inside `uow.run` that throws afterwards leaves the go's `used_at` null after the rollback.
- FR-DRAFTS-02-15 (10): the in-memory unit of work gives the same result as the SQLite one for the same take inside a failing `uow.run`.

## Build
```ts
export interface Transaction { /* existing fields */ readonly pendingGoes: PendingGoStore; }
```

## Done when
`bun test test/drafts/unit-of-work.test.ts`

## Out of scope
The go's logic (SPEC-07), the send (SPEC-12), and the store's own behaviour (SPEC-10-2).

## Open questions
None.
