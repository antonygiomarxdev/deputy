# SPEC-10-2: the SQLite pending-go store

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Implements the PendingGoStore of SPEC-07 over `pending_goes`, so a restart keeps the go until one send uses it or a newer go for the chat replaces it (R-DRAFTS-23). A take marks the row used with `used_at` and `send_id`. Depends on SPEC-10-1.

Last change: 2026-11-24, after the lead's decision: the owner's go is recorded in pending_goes, not in approvals or the drafts log.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-15 | WHEN | When Deputy restarts, a go shall stay until one send uses it or a newer go for the same chat replaces it. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/sqlite-pending-go-store.ts | Create | `SqlitePendingGoStore`, which implements `PendingGoStore` |
| test/drafts/contract/pending-go-store.contract.ts | Create | The store contract: the cases below, run by any store |
| test/drafts/contract/pending-go-store.sqlite.test.ts | Create | Runs the contract against the SQLite store; it opens its own database with a local opener that runs migrations 0001 to 0005 |

## Reuses
- Precedent: SPEC-07-ask-owner-go.md, the `PendingGoStore` port this store implements.
- Precedent: SPEC-04-drafts-log.md Task 2, whose contract-plus-sqlite-runner layout this follows.

## Tests first
- FR-DRAFTS-02-15 (4): a go put for chat "c1", then a new store on the same database (a restart), takes it and returns the same question id, text and time.
- FR-DRAFTS-02-15 (5): a go already taken, a second take for that chat returns null, and the row keeps its `used_at` and `send_id`.
- FR-DRAFTS-02-15 (7): given go rows used on two days, `usedBetween` returns the used rows in the range with their chat id and `used_at`, and no unused rows.
- FR-DRAFTS-02-15 (6): a second put for the same chat before any take replaces the unused go: one take returns the second go only.
- FR-DRAFTS-02-15 (8): a second put with the same questionId inserts no second row.

## Build
```ts
export class SqlitePendingGoStore implements PendingGoStore {
  constructor(db: SqlExecutor);
  async put(go: PendingGo): Promise<void>;                                  // idempotent by questionId: if a row has it, do nothing; else delete the unused go for the chat, then insert
  async take(chatId: string, now: number, sendId: string): Promise<PendingGo | null>;  // returns the unused go, sets used_at = now and send_id
  async usedBetween(fromMs: number, toMs: number): Promise<{ chatId: string; usedAt: number }[]>;  // used rows in the range, for SPEC-08
}
```

## Done when
`bun test test/drafts/contract/pending-go-store.sqlite.test.ts`

## Out of scope
The window check and the go's logic (SPEC-07), the wiring (SPEC-11), and the send path (SPEC-12).

## Open questions
None.
