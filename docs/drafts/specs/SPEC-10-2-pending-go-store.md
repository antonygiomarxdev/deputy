# SPEC-10-2: the SQLite pending-go store

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Implements the PendingGoStore of SPEC-07 over `pending_goes`, so a restart keeps the go until one send uses it or a newer go for the chat replaces it (R-DRAFTS-23). Depends on SPEC-10-1.

Last change: 2026-11-24, split and extended after the review of PR 202 (pending go async; optional automatic; wiring and send-path specs added).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-15 | WHEN | When Deputy restarts, a go shall stay until one send uses it or a newer go for the same chat replaces it. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/sqlite-pending-go-store.ts | Create | `SqlitePendingGoStore`, which implements `PendingGoStore` |
| test/drafts/contract/pending-go-store.contract.ts | Create | The store contract: the cases below, run by any store |
| test/drafts/contract/pending-go-store.sqlite.test.ts | Create | Runs the contract against the SQLite store |

## Reuses
- Precedent: SPEC-07-ask-owner-go.md, the `PendingGoStore` port this store implements.
- Precedent: SPEC-04-drafts-log.md Task 2, whose contract-plus-sqlite-runner layout this follows.

## Tests first
- FR-DRAFTS-02-15 (4): a go put for chat "c1", then a new store on the same database (a restart), takes it and returns the same question id, text and time.
- FR-DRAFTS-02-15 (5): a go already taken, a second take for that chat returns null, and the row keeps its `used_at`.
- FR-DRAFTS-02-15 (6): a second put for the same chat before any take replaces the unused go: one take returns the second go only.

## Build
```ts
export class SqlitePendingGoStore implements PendingGoStore {
  constructor(db: SqlExecutor);
  async put(go: PendingGo): Promise<void>;                             // deletes the unused go for the chat, then inserts
  async take(chatId: string, now: number): Promise<PendingGo | null>;  // returns the unused go and sets used_at = now
}
```

## Done when
`bun test test/drafts/contract/pending-go-store.sqlite.test.ts`

## Out of scope
The window check and the go's logic (SPEC-07), the wiring (SPEC-11), and the send path (SPEC-12).

## Open questions
None.
