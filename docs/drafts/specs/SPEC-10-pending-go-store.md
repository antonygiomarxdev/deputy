# SPEC-10: the pending go survives a restart

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Stores the pending go of SPEC-07 in Drafts' SQLite database, so a restart does not lose it (FR-DRAFTS-02-15, R-DRAFTS-23). A new migration adds the `pending_goes` table; the store implements the `PendingGoStore` port of SPEC-07. Depends on SPEC-07 (the port) and on SPEC-09-3 (migration 0004, so 0005 comes after it).

Last change: 2026-11-24, new spec closing SPEC-07 Q-2.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-15 | WHEN | When Deputy restarts, a go shall stay until one send uses it or a newer go for the same chat replaces it. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/migrations/0005-pending-goes.sql | Create | Table `pending_goes` (id INTEGER PRIMARY KEY, question_id TEXT NOT NULL, chat_id TEXT NOT NULL, text TEXT NOT NULL, answered_at INTEGER NOT NULL, used_at INTEGER) and an index on (chat_id, used_at) |
| src/drafts/adapters/sqlite/sqlite-pending-go-store.ts | Create | `SqlitePendingGoStore`, which implements `PendingGoStore` |
| src/main/database.ts | Change | Registers 0005-pending-goes.sql in the migration list |

## Reuses
- Precedent: SPEC-07-ask-owner-go.md, the `PendingGoStore` port this store implements.
- Precedent: SPEC-09-3-automatic-column.md, which adds migration 0004 and registers it in `src/main/database.ts`; this spec does the same for 0005.
- The store's contract cases are added to the Drafts contract suite (`test/drafts/contract`), as SPEC-09-3 does; they are not a Files row.

## Tests first
- FR-DRAFTS-02-15 (1): given a go put for chat "c1", a new store on the same database (a restart) takes it and returns the same question id, text and time.
- FR-DRAFTS-02-15 (2): given a go already taken, a second take for that chat returns null, and the row keeps its `used_at`.
- FR-DRAFTS-02-15 (3): given a second put for the same chat before any take, the unused go is replaced: one take returns the second go only.

## Build
```ts
export class SqlitePendingGoStore implements PendingGoStore {
  constructor(db: SqlExecutor);
  put(go: PendingGo): void;                              // deletes the unused go for the chat, then inserts
  take(chatId: string, now: number): PendingGo | null;   // returns the unused go and sets used_at = now
}
```
The migration creates `pending_goes` as listed in Files. The `PendingGoStore` port of SPEC-07 takes `now` in `take`, which SPEC-07 now states.

## Done when
`bun test test/drafts/contract`

## Out of scope
The window check and the go's logic (SPEC-07), the approval entry written at send time (the send path), and the `chatId` on the question (FR-INTAKE-05-25, Intake PR #206, pending).

## Open questions
None.
