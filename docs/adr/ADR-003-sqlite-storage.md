# ADR-003: One SQLite file for Deputy's data; owner files stay files

## Status
Proposed

## Context
FR-DRAFTS-02-12 needs "mark approval used and draft sending" as one step that cannot be done twice. FR-INTAKE-02-7 needs a stored message never repeated. The current JSONL, CSV and `state.json` have no transactions, write non-atomically, and trim the seen-id list at 500, which breaks once catch-up replays old ids (`docs/research/codebase.md`, C15). `bun:sqlite` is built in. From TP TD-3.

## Decision
- One SQLite file in the data folder (WAL, `busy_timeout`) for messages, send ids, catch-up status, rejections, owner numbers, drafts, approvals, the drafts log, ignore list and its log, settings, notice state, lessons, proposals, knowledge log, orders with items, history, message links and deleted marks, and setup progress.
- `messages` has a unique `(provider, provider_message_id)`.
- The drafts log is append-only: triggers reject UPDATE and DELETE (FR-DRAFTS-04-7). One named function is the only exception: it replaces the owner's words in an order's log entries with "deleted" (L6, FR-DRAFTS-04-10). It also clears the order text kept in `drafts` and `approvals` (L6), and runs inside Drafts in a Drafts-only transaction, as the idempotent handler of the `OrderDeleted` event `{eventId, orderId, draftNumber, chat}`. Orders deletes the order and writes the event into its own outbox in one Orders write, and re-sends pending outbox rows at start. No transaction crosses slices, and it works when Orders lives in a spreadsheet.
- The business profile (Markdown) and the catalog (table file) stay owner-edited files, or the owner's spreadsheet. Orders go to SQLite unless the owner chose a spreadsheet; both sit behind the `Store` shape.
- `Message` is its own aggregate, keyed by provider and provider message id and holding a `ChatId`. `Chat` keeps only its state (last customer message, last owner or Deputy answer, source of that answer), recomputed inside the store transaction; `MessageStored` is only a hint to other slices. An "approved" draft state is never stored: the approval (born used) and "sending" are one transaction. The `lease` row (ADR-002) lives in the same file.
- Each aggregate has a repository port in its slice and a SQLite adapter. A `UnitOfWork` port per slice gives one-transaction steps. The spreadsheet is a second adapter of the order and catalog ports (ADR-000).
- Exports (knowledge, orders, log) give the owner a readable copy.
- Migrations: the schema version is `PRAGMA user_version`; the schema is ordered `.sql` files, each slice keeping its own in its SQLite adapter and the composition root holding one ordered list that sets the global numbers, embedded in the binary with `import sql from "./0001-init.sql" with { type: "text" }`. At start, before the lease, a process runs `BEGIN IMMEDIATE`, reads the version, runs every higher file in order, sets `user_version` and commits, all in one transaction, so a failed file changes nothing. A second process waits on `busy_timeout`, re-reads the version and finds nothing to do. Before changing an existing file it copies the database to `deputy.db.bak-v<N>`. A database newer than the binary is not opened ("update Deputy"). A migration that rebuilds `drafts_log` re-creates the append-only triggers and the scrub guard in the same file. I checked in Bun 1.4.4, from source and from a compiled binary: a `.sql` text import, a trigger created by a migration that rejects UPDATE, and a `user_version` rolled back with its transaction.
- Tests: a fixture database per released version (`test/fixtures/db/v<N>.sqlite`, added in the same change as the migration); each is upgraded to the latest and must keep its rows, have the newest `user_version`, still reject UPDATE and DELETE on `drafts_log`, and still allow the L6 scrub; a failing migration leaves version and data unchanged.
- Every port returns a Promise, including repositories and `SqlDatabase`, so a sync-capable adapter fits.
- Repositories reach the database only through a `SqlDatabase` port (`query`, `run`, `transaction`) in the shared kernel, with plain SQLite SQL. Only its adapter imports `bun:sqlite`, and it sets `PRAGMA secure_delete = ON` at open so an erased order's text does not stay in free pages. That keeps a later sync engine (for example Turso's `@tursodatabase/sync`) to one adapter.

## Alternatives
- Keep JSONL, CSV and `state.json`: no transactions; cannot meet FR-DRAFTS-02-12.
- An embedded key-value store: a new dependency and no relational queries.
- A migration library or ORM (for example drizzle-kit): a dependency and a generated-SQL layer for a dozen ordered files; the `.sql` files plus `user_version` need about 30 lines and are testable with fixtures.
- A `schema_version` table row (the first proposal): it needs a table to exist before the first migration can read it, and a failed migration could leave the row and the schema out of step; `user_version` lives in the file header and commits with the transaction.
- Turso's local database now, with sync later: SQLite-compatible and a direct path to sync, but a new dependency on a newer engine whose trigger support and concurrency must be verified first. Kept reachable through the `SqlDatabase` port instead.

## Consequences
- Easier: idempotent storing, atomic send step, "latest message per chat" and log queries.
- Harder: a binary file the owner cannot open by hand; schema migrations to maintain.
- Watch: sync is out of v1. It needs the owner's choice (D7), and a design for the lease and the append-only log across devices, in its own ADR.
- Watch: the L6 exception to append-only was accepted by the owner (D15); it is tested as the only path that rewrites a log row.
