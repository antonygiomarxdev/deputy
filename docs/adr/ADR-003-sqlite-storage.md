# ADR-003: One SQLite file for Deputy's data; owner files stay files

## Status
Proposed

## Context
FR-DRAFTS-02-12 needs "mark approval used and draft sending" as one step that cannot be done twice. FR-INTAKE-02-7 needs a stored message never repeated. The current JSONL, CSV and `state.json` have no transactions, write non-atomically, and trim the seen-id list at 500, which breaks once catch-up replays old ids (`docs/research/codebase.md`, C15). `bun:sqlite` is built in. From TP TD-3.

## Decision
- One SQLite file in the data folder (WAL, `busy_timeout`) for messages, send ids, catch-up status, rejections, owner numbers, drafts, approvals, the drafts log, ignore list and its log, settings, notice state, lessons, proposals, knowledge log, orders with items, history, message links and deleted marks, and setup progress.
- `messages` has a unique `(provider, provider_message_id)`.
- The drafts log is append-only: triggers reject UPDATE and DELETE (FR-DRAFTS-04-7). One named function is the only exception: it replaces the owner's words in an order's log entries with "deleted" (L6, FR-DRAFTS-04-10). It runs inside Drafts in a Drafts-only transaction, as the idempotent handler of the `OrderDeleted` event. Orders deletes the order and writes the event into its own outbox in one Orders write, and re-sends pending outbox rows at start. No transaction crosses slices, and it works when Orders lives in a spreadsheet.
- The business profile (Markdown) and the catalog (table file) stay owner-edited files, or the owner's spreadsheet. Orders go to SQLite unless the owner chose a spreadsheet; both sit behind the `Store` shape.
- `Message` is its own aggregate, keyed by provider and provider message id and holding a `ChatId`. `Chat` keeps only its state (last customer message, last owner or Deputy answer, source of that answer) and is updated from `MessageStored` events. The `lease` row (ADR-002) lives in the same file.
- Each aggregate has a repository port in its slice and a SQLite adapter. A `UnitOfWork` port per slice gives one-transaction steps. The spreadsheet is a second adapter of the order and catalog ports (ADR-000).
- Exports (knowledge, orders, log) give the owner a readable copy.

## Alternatives
- Keep JSONL, CSV and `state.json`: no transactions; cannot meet FR-DRAFTS-02-12.
- An embedded key-value store: a new dependency and no relational queries.

## Consequences
- Easier: idempotent storing, atomic send step, "latest message per chat" and log queries.
- Harder: a binary file the owner cannot open by hand; schema migrations to maintain.
- Watch: the L6 exception to append-only was accepted by the owner (D15); it is tested as the only path that rewrites a log row.
