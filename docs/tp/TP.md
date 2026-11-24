# Technical Proposal: Deputy v1 (cross-cutting)

Status: Approved (2026-11-18)., for owner review (amended 2026-11-18 for L7 and L8). Written 2026-11-17 after the FRDs. Each decision (TD) has one ADR in `docs/adr/`. Per-FRD TPs and specs follow this one.

## Context

What exists. A push-only reply bot: webhook in, `notifications/claude/channel` to the agent, the agent calls `reply` and Deputy sends at once. No draft, no go, no catch-up, no inbox (`docs/research/codebase.md`, conflicts C1 to C20). About 330 lines of server, JSONL history, a CSV store, an `operator/` profile, and a permission relay.

What the FRDs ask. A pull-first assistant. The agent reads an inbox, drafts, and the owner's go in the conversation releases each send. Messages arrive by catch-up (D12). Seven slices: Intake, Inbox, Drafts, Notify, Knowledge, Orders, Setup.

Facts that bind the design:

| Fact | Source | Effect |
|---|---|---|
| Only tools are confirmed in every MCP client checked (Claude Code, Codex, Cursor, Gemini CLI, VS Code). Server `instructions` are confirmed for Claude Code, Codex and Gemini CLI. | `docs/research/agents.md` Q2, Q4 | The core is tools plus instructions. Rules also go in tool descriptions. |
| Claude Code channel push needs `--dangerously-load-development-channels`, is a research preview, and may change. | `agents.md` Q1 | Push is an optional extra. |
| A stdio server lives as long as its client session. Two sessions mean two processes. | `agents.md` Q3 | One owner process per data folder. |
| Kapso lists conversations by `last_active_after`, then messages per conversation (newest first, no time filter, cursors). 100 requests per minute on Free. `429` carries `Retry-After`. | `docs/research/kapso.md` Q3, rate limits | Catch-up design (TD-5). |
| Owner echoes carry `kapso.origin = "business_app"` in the API (live check 2026-11-17). Which webhook event carries them is unknown. | `kapso.md` | Echoes come from catch-up. |
| Webhooks: HMAC-SHA256 of the raw body in `X-Webhook-Signature`, `X-Idempotency-Key`, 10 s to answer. | `kapso.md` Q4 | Optional live listener. |
| `bun:sqlite` is built in. No new dependency. | `codebase.md` Dependencies | TD-3. |

Decisions this TP rests on: D14 (hexagonal architecture, DDD and clean architecture; the old code's structure is not kept, only small pieces are reused inside adapters), D1 (the go), D5 (notices), D6 (credentials), D11 (known limit), D12 (receiving), L2 (source), L4 (ignore list and owner numbers), L5 (one numbering), L6 (order entries).

## Requirements served

Every FRD is served. The FRs that shape the architecture most:

- Go and send: FR-DRAFTS-01-1, FR-DRAFTS-01-7, FR-DRAFTS-02-3, FR-DRAFTS-02-5, FR-DRAFTS-02-7, FR-DRAFTS-02-12, FR-DRAFTS-03-1, FR-DRAFTS-03-3, FR-DRAFTS-03-8, FR-DRAFTS-03-13, FR-DRAFTS-04-7, FR-DRAFTS-04-10.
- Receive and store: FR-INTAKE-01-1, FR-INTAKE-01-9, FR-INTAKE-02-1, FR-INTAKE-02-7, FR-INTAKE-02-9, FR-INTAKE-03-1, FR-INTAKE-03-6, FR-INTAKE-03-10, FR-INTAKE-03-19, FR-INTAKE-03-20, FR-INTAKE-04-5, FR-INTAKE-04-13.
- Inbox: FR-INBOX-01-1, FR-INBOX-02-2, FR-INBOX-02-16, FR-INBOX-03-10.
- Notices: FR-NOTIFY-01-1, FR-NOTIFY-01-5, FR-NOTIFY-02-10, FR-NOTIFY-03-4, FR-NOTIFY-03-6.
- Knowledge and Orders: FR-KNOWLEDGE-01-8, FR-KNOWLEDGE-01-10, FR-KNOWLEDGE-02-5, FR-KNOWLEDGE-03-4, FR-ORDERS-01-7, FR-ORDERS-01-14, FR-ORDERS-02-4, FR-ORDERS-03-5.
- Setup: FR-SETUP-01-5, FR-SETUP-03-1, FR-SETUP-03-4, FR-SETUP-03-7.

The Interfaces section maps every tool to its FRs.

## Decisions

### TD-0: Architecture style

- **Option A** Ports and adapters (hexagonal) with DDD. Each slice is a bounded context with `domain`, `application`, `ports` and `adapters` folders. A small shared kernel. One composition root wires adapters to ports. An architecture test enforces the dependency rule. Cost: more files and interfaces than the current 330-line server; a rewrite. Risk: ceremony beyond what v1 needs (mitigated: one use case per file, no generic frameworks, no event bus library).
- **Option B** Keep the current layered layout (`server.ts`, `providers/`, `store/`) and add slice folders. Cost: least work. Risk: the MCP server holds the rules, so tests need a real server and a real provider, and the send rule of D1 is scattered.
- **Option C** Vertical slices without ports (each slice calls SQLite and the provider directly). Cost: less indirection. Risk: no in-memory tests of use cases, and the provider and storage are hard to swap (Kapso, dev, spreadsheet).

Chosen: Option A, by owner decision D14. It fits the product: the provider (Kapso or dev), the storage (SQLite or spreadsheet), the agent (MCP) and the push channel are all things that change, and the FRDs' Given/When/Then lines are rules that should run without any of them. The aggregates are Message, SyncState, RejectionNote and OwnerNumbers (Intake; `Chat` is a small projection, not an aggregate holding messages); IgnoreList and InboxSettings (Inbox); Draft, with its approvals, and DraftLog (Drafts); NoticeState and NotifySettings (Notify); Proposal and LearnedItem (Knowledge; the profile and the catalog are owner files behind ports); Order (Orders); SetupProgress (Setup). The Information section gives the one list with repositories. Recorded in ADR-000.

### TD-1: How does the agent talk to Deputy?

- **Option A** One MCP server over stdio. The core is tools plus server `instructions`. Works in Claude Code, Codex, Cursor and Gemini CLI. Claude Code channel push is an optional extra behind a setting. Cost: low, it is what the repo already has. Risk: an agent that ignores `instructions` (Cursor and VS Code pages do not state support). Mitigation: the key rules sit in tool descriptions too.
- **Option B** A CLI the agent shells out to. Cost: every agent needs a shell. Risk: the agent then has a shell, which is the bypass D11 warns about, and every call needs a permission prompt.

Chosen: Option A. The MCP server is one inbound adapter over the use cases (TD-0). It is the only path that works across agents (principle 4) and keeps working with push off. The permission relay is removed: the go is given in the conversation (D1), and a permission dialog never replaces it (FR-DRAFTS-02-7). Research gave no reason to depart from the lean. Recorded in ADR-001.

### TD-2: One process, one owner

- **Option A** A lease row in the SQLite file: `lease(token, holder_started, heartbeat)`. The owner renews it every 10 seconds. A process takes it over in one SQL statement (`UPDATE ... WHERE token = :seen AND heartbeat < now - 30 s`), so only one takeover wins. No pid, so no pid reuse and no stale file. The owner polls, listens, sends. A second process serves reads and says so. Cost: one small write every 10 seconds; the loser keeps a read-write connection (its write use cases refuse). Risk: a blocked event loop longer than 30 seconds loses the lease (safe: the owner finds out at its next write check).
- **Option B** A lock file `owner.lock` with `{pid, startedAt}`. Cost: a small lock adapter. Risk: pid reuse after a crash; takeover races between two losers (one can delete the other's fresh lock); the owner can delete the file and create two owners; a read-only open of a WAL database needs the `-shm` file, unverified on Windows.
- **Option C** A separate always-on daemon that owns everything; MCP processes are thin clients. Cost: install, start-up and a second thing to run. Risk: against "not always on" and the 30-minute setup target (PRODUCT section 8).

Chosen: Option A. It needs no daemon, has no pid or stale-file failure, and is atomic because SQLite serializes the update. Takeover is atomic, as required: one UPDATE, the same guarantee as an exclusive file create. Departure from the lean (lock file with pid): the review found the takeover race, the deleted-file case and the pid-reuse case in Option B, and the lease row removes all three. The lease token is a random value held in memory. `OwnerLease.isOwner()` reads the row on every write check and compares the token, so a lost lease is seen at once. The send step (TD-6) includes the token check in its own transaction, so a process that lost the lease cannot mark an approval used. Read-only is enforced in the application layer: every use case that writes or sends asks the `OwnerLease` outbound port (a shared-kernel port, like `Clock`; adapter: the lease row) and refuses with a plain reason ("another Deputy session owns this data") when this process is not the owner. The MCP adapter, the scheduler and the listener therefore get the same rule, and it is unit-tested with an in-memory lease. A `LeaseSupervisor` in `src/main.ts` checks the lease every 10 seconds: when this process becomes owner it first runs recovery on every acquisition (Intake `MarkInterruptedSends`, Drafts `RecoverInterrupted`, then the order re-drive `RedriveRecording`, Orders' `RedriveOutbox` and Notify's `StartNoticeSession`, which reads the time zone and opens the notice clock), and only then starts the scheduler and the listener (the port is bound only after the lease is won and recovery is done); when it loses the lease it stops them. A loser that takes over later therefore starts them. Release happens on stdin close, SIGINT and SIGTERM by clearing the heartbeat. Why 10 and 30 seconds: a renewal is one tiny write, so six a minute cost nothing; the lease is three renewals long, so a stall of up to 20 seconds (garbage collection, a busy disk, a short pause) does not lose it, while a dead owner is replaced in at most 30 seconds, well under the default 2-minute catch-up period, so no catch-up run is lost. Both are domain constants, not settings. Recorded in ADR-002.

### TD-3: Where does data live?

- **Option A** One local SQLite file (`bun:sqlite`, WAL) for messages, drafts, approvals, the drafts log, ignore list, settings, lessons, proposals, orders and their history, the lease, setup progress. The business profile stays a Markdown file and the catalog a table file (or the owner's spreadsheet). Cost: schema and migrations to write (mechanism below). Risk: a binary file the owner cannot read; Deputy therefore offers exports (FR-KNOWLEDGE-03-3, FR-ORDERS-03-6).
- **Option B** One JSON file per aggregate, written by temp file and atomic rename, with a lock file as the only-writer rule. Cost: no schema or migrations, and the owner can read every file. Risk: no multi-file transaction (the send step then depends on one draft file holding approval, state and a log pointer); the append-only log and "latest message per chat" need hand-built indexes; the old design's 500-id seen list is a known failure (C15).

- **Option C** Turso's local database (`@tursodatabase/database`, SQLite-compatible, file on disk), which later turns into a synced database through `@tursodatabase/sync` (local reads and writes, explicit `push()` and `pull()` to Turso Cloud). Cost: a new dependency instead of a built-in one. Risk: the engine is newer than SQLite, and support for features this TP relies on (triggers, WAL concurrency with a second read-only process) must be verified before use.

Chosen: Option A, written so that Option C stays one adapter away. Repository adapters use plain SQLite SQL through a small `SqlDatabase` port in the shared kernel (`query`, `run`, `transaction`). Its SQLite adapter sets `PRAGMA secure_delete = ON` when it opens a file, so deleted rows are overwritten and an erased order's text does not stay in free pages (FR-ORDERS-02-10a; Orders ADR-010). Every port returns a Promise, including every repository and `SqlDatabase`, so a sync-capable adapter fits without changing a caller; only its adapter imports `bun:sqlite`. No `bun:sqlite`-only feature is used. A sync adapter (Turso or another) can then replace that one adapter without touching any repository. Sync itself is out of v1: it sends data off the owner's machine, which needs the owner's choice under D7. It also needs a design for the lease and the append-only log across devices. It would come with its own ADR. `Message` is its own aggregate, keyed by provider and provider message id, holding a `ChatId` reference. A unique `(provider, provider_message_id)` makes storing idempotent (FR-INTAKE-02-7). One transaction records the approval (born used) and sets the draft "sending" before the provider call (FR-DRAFTS-02-12). An "approved" state is never stored: approval and "sending" are one step. Triggers reject UPDATE and DELETE on the drafts log (FR-DRAFTS-04-7), with one narrow exception: the order scrub of L6 (FR-DRAFTS-04-10). The scrub is a single named function inside Drafts. It also clears the order text kept in drafts and approvals (`drafts.current_text`, `drafts.order_payload`, `approvals.text` of the order's drafts) in the same Drafts transaction; the draft rows stay. It is not in the same transaction as the order delete: Orders may live in a spreadsheet, and no transaction crosses slices. Orders deletes the order and writes an `OrderDeleted` event `{eventId, orderId, draftNumber, chat}` into its own outbox in one Orders write. Drafts handles the event idempotently and scrubs its log in a Drafts-only transaction. Orders re-sends any outbox row still pending at start. The owner accepted this one narrow, tested exception (D15). Migrations: the schema version is `PRAGMA user_version`, and the schema is ordered `.sql` files. Each slice keeps its own files in its SQLite adapter (`src/<slice>/adapters/sqlite/migrations/`), so only a slice's adapter holds that slice's tables. The composition root holds one ordered list of all the files, and a file's position in that list is the global number that `user_version` records, so two slices never number their own. The files are embedded in the binary with `import sql from "./0001-init.sql" with { type: "text" }` (checked: Bun 1.4.4 runs it, and inside a `bun build --compile` binary, with a trigger migration and a rolled-back `user_version`). At start, before the lease, a process runs `BEGIN IMMEDIATE`, reads `user_version`, runs every file numbered above it in order, sets `user_version` to the last number and commits: all pending files in one transaction, so a failed file leaves the old version untouched (SQLite DDL and `user_version` are transactional; checked). A second process waits on the write lock (`busy_timeout`), re-reads the version inside its own transaction and finds nothing to do. Before it changes an existing file, it copies the database to `deputy.db.bak-v<N>` (data-loss guard; the copy is kept until the next successful start of a newer version). A database whose `user_version` is newer than the binary knows is not opened: the process says "update Deputy" and exits, so an old binary cannot damage a newer schema. The append-only triggers belong to the schema: any migration that rebuilds `drafts_log` (SQLite cannot alter a column in place) drops and re-creates the triggers and the scrub's guard in the same file. Tests: for each released version keep a fixture database (`test/fixtures/db/v<N>.sqlite`, made by that release's own migrations and filled with rows); the upgrade test opens each, migrates to the latest, and asserts the rows are intact, `user_version` equals the newest file, an UPDATE and a DELETE on `drafts_log` are rejected, and the L6 scrub still works; one more test fails a migration halfway and asserts the version and the data are unchanged. The rule for a release: add the new version's fixture in the same change that adds its migration. Recorded in ADR-003. Each aggregate has a repository port in its slice and a SQLite adapter; a `UnitOfWork` port per slice gives the one-transaction steps. Orders are rows in SQLite unless the owner chose a spreadsheet (FR-ORDERS-03-2); that is a second adapter of the same `OrderRepository` port. Recorded in ADR-003.

### TD-4: Provider adapter

- **Option A** Intake owns the provider connection. Outbound port `Provider`: list conversations active since a time, list messages of a conversation (paged), send text, and optional live-delivery parse plus verify. Kapso and dev implement it. Intake publishes `SendText` as an inbound port; Drafts' `Sender` outbound port is implemented by an adapter that calls it. The Meta provider is deleted. Cost: a small rewrite of `types.ts` and `providers/`. Risk: Kapso's REST shape changes; it is isolated in one file.
- **Option B** Drafts has its own sender adapter beside Intake's provider. Cost: no cross-slice call for sending. Risk: two Kapso clients each pace themselves and together break the 100 requests per minute limit; one adapter would import two slices' outbound ports.
- **Option C** The Kapso SDK. Cost: a dependency and its normalizer (it sets `kapso.source`, which the platform API does not). Risk: hides the raw `origin` field Intake needs (FR-INTAKE-04-12).

Chosen: Option A. One client in one slice means one place paces every request, sends included (FR-INTAKE-03-18). `SendText({sendId, chat, text})` first records the send id and the pending outgoing text, then sends, then stores the provider message id by an upsert. The `Provider` call is `sendText({to, text})`, one part of at most 4000 characters, and returns `{providerMessageId, serverTime}`; the stored send time is that `serverTime`. Echo matching (L2) therefore lives in one slice. Resolving an unknown outcome uses Intake's `FindOutgoing({sendId, chat, since, text})` (see TD-6). It keeps dev and Kapso indistinguishable to other slices (FR-INTAKE-01-4). `graph.ts` keeps `splitText` and the send helper; `meta.ts` goes (FR-INTAKE-01-1). Recorded in ADR-004.

The decisions TD-5, TD-6 and TD-8 moved verbatim to [TP-decisions.md](../tp-detail/TP-decisions.md).

### TD-7: Notices and reminders

- **Option A** The owner process runs a scheduler adapter that calls Notify's `Tick` use case; the use case builds counts-only notices from Intake's "message stored" event and the inbox. It batches (default 10 minutes), reminds (default 30 minutes), keeps quiet periods and sends the outage notice. It delivers through the Claude channel when that is on. Otherwise nothing is pushed and the `inbox` tool covers it. Cost: a small timer module. Risk: depends on the research-preview channel; a push has no acknowledgement (FR-NOTIFY-03-6).
- **Option B** A long-poll tool, `wait_for_messages`, that the agent calls and that returns when notable messages arrive. Cost: works in any MCP agent, with no research-preview channel. Risk: it holds the agent's turn, tool timeouts differ (Codex defaults to 60 seconds), and the owner cannot use the session for other work while it waits. Not chosen as the default; it stays a later option for agents without push.

Chosen: Option A. The `Notifier` outbound port has a Claude channel adapter and a null adapter. Notices are fixed codes with an English default text, filled with numbers only, so no customer text can enter one (FR-NOTIFY-01-5). Language (D20): Deputy ships no language catalogs; a notice, hold reason, refusal or status reason is a code, the English default text and its numbers, and the server `instructions` tell the agent to say it in the owner's language. Time zone: `time_zone` defaults to the system zone, `Intl.DateTimeFormat().resolvedOptions().timeZone`, read once at first start and stored; the owner can change it by talking (`set_setting`). Quiet periods are wall-clock hours in that zone, evaluated with `Intl.DateTimeFormat` for the zone on each tick, never by adding hours to a UTC offset. DST test (America/New_York, quiet 22:00 to 07:00, checked in Bun): on 2026-03-08 the local time is 01:59 at 06:59Z and 03:01 at 07:01Z (no 02:xx), and the period ends at 11:00Z (07:00 local), so the period that began at 22:00 the evening before lasts 8 real hours; on 2026-11-01 the period ends at 12:00Z (07:00 local) and the period lasts 10 real hours, 01:30 occurs at 05:30Z and at 06:30Z and both are quiet. `Tick` reads the ignore list from Inbox on every notice (FR-NOTIFY-02-10) and the source of each message from Intake (FR-NOTIFY-03-1). A notice written with no error counts as delivered; with no session or an error, it counts as failed and its messages are counted again next time (FR-NOTIFY-03-7). With push off, no notice is sent (FR-NOTIFY-03-4). Recorded in ADR-007.

### TD-9: What is removed

- **Option A** Remove: `operator/` and `scripts/operator.sh` (owner decision, PRODUCT section 6), the permission relay and `lang`, `notify_owner` to WhatsApp, per-message push with customer text, the Meta provider, `reply`, `create_order`, `handoff` and `resume`, the echo pause, `conversations.ts` and `state.json`. Cost: lost behavior that the FRDs contradict. The old structure is not kept; only small pieces move into adapters (`splitText`, rewritten to cut on grapheme boundaries (Intake TP-04), and the HMAC check; the CSV parser and the Google JWT helper are replaced by libraries, TD-12). Risk: tests that assert it must change.
- **Option B** Migrate in steps: keep the old tools and the operator profile until each slice's replacement passes its acceptance tests, then delete them. Cost: two models of sending exist for a while, which D1 and FR-DRAFTS-02-7 forbid in a release. Risk: a half-migrated build could ship a direct send path. Acceptable only on a branch that is never released.

Chosen: Option A. Each removal maps to a conflict in `codebase.md`: C1 and C2 (`reply`), C3 (`create_order`), C4 (`notify_owner`), C5 and C19 (relay, `lang`), C6 (pause, handoff), C7 (per-message push), C9 (Meta), C18 (operator allow-list). Tests that change: `test/e2e.test.ts` is rewritten per slice; its five tests assert removed behavior (`reply` sends at once, handoff pause, permission relay), so the relay and Meta tests are deleted, the dev-flow test is rewritten around a draft and a go, and the Kapso test is ported to signature check plus catch-up. The harness (`start`, `sseCollector`, `post`, `call`) is kept. `test/unit.test.ts` stays (CSV, `splitText`). `README.md`, `README.es.md` and `CLAUDE.md` change with the code (C20). Recorded in ADR-009.

### TD-10: Runtime, packaging and conventions

- **Option A** Run from source: Bun and TypeScript with no build step, installed with one command that needs Bun on the owner's machine. Cost: none new. Risk: a non-technical owner must install Bun first, which strains the 30-minute setup target.
- **Option B** Ship a compiled binary built with `bun build --compile`; development still runs `src/` directly with no build step (`bun test`, `bun run typecheck`). `zod` validates every tool input. Each slice follows TD-0 (`src/<slice>/{domain,application,ports,adapters}` and an `index.ts`). Cost: a release build per OS and a packaging pipeline. Risk: the SQLite and file paths must work inside the compiled binary; a release can break while development works.

Chosen: Option B, by owner decision D17. The owner installs one binary; no runtime to install. The same binary carries the subcommands of TD-8 (`deputy config`, `deputy secrets`) and the MCP server (`deputy serve`). The package name stays open until launch (D17). `zod` is already a dependency and tool arguments are untrusted input (`codebase.md`: arguments are cast `as Record<string, any>` today). A slice talks to another only through its `index.ts` (for example Inbox's adapter calls Drafts' `WaitingChats` port, FR-DRAFTS-01-4). The release build runs the whole test suite against the compiled binary too, so a binary-only failure is caught. Recorded in ADR-010.

### TD-11: Testing (ATDD)

- **Option A** For each FRD, its Given/When/Then become executable tests first. Use cases are tested with in-memory adapters; acceptance tests drive the use cases through inbound ports; an architecture test enforces the dependency rule. End-to-end tests start the server over stdio with the dev provider and a fake Kapso HTTP server (rate limits, pagination, echoes, outages). A test names the FR it covers. Cost: a fake Kapso server and a fake clock. Risk: the fake drifts from real Kapso; mitigated by one live check per release.
- **Option B** Contract tests against recorded real Kapso responses (no fake server). Cost: no server to keep in step; replay is exact. Risk: cannot make rate limits, outages or new echo shapes happen on demand, and the recordings go stale.

Chosen: Option A. It follows D13. The FRDs already hold Given/When/Then lines tagged `Tests FR-...`; each becomes a test titled with its FR id, so a missing FR shows as a missing test. The architecture test parses imports and fails when `domain` imports anything outside `domain` and `src/shared/`, when `application` imports `adapters`, or when a slice imports another slice's file other than its `index.ts`. Time-dependent logic (batching, reminders, quiet periods, catch-up period) takes the `Clock` port, with a fake clock in tests. Recorded in ADR-011.

### TD-12: How are the catalog file and the Google sign-in read?

Deputy serves owners in many countries. Their catalog files differ in separator (`,` in the US and Mexico, `;` in much of Europe and Latin America, tab from some exports), in number format (`1.234,50` or `1,234.50`), in header language and in column order. The old reader was hand-written and read only comma files with English and Spanish headers. The Google service-account sign-in was a hand-written JWT helper.

- **Option A** Keep both hand-written helpers. Cost: none now. Risk: a hand-written CSV reader gets quoted separators, embedded newlines, a byte-order mark and delimiter guessing wrong in ways only real files reveal; a hand-written RS256 signer is security code Deputy would own.
- **Option B** `papaparse` 5.7.1 (MIT, last published 2026-11-11) for the table and `jose` 6.2.17 (MIT, last published 2026-11-09, no dependencies) for the sign-in. Papaparse guesses the delimiter among comma, tab, pipe, semicolon and the ASCII separators and reports it in `meta.delimiter`; it strips a byte-order mark and handles quoted separators and newlines. `jose` signs an RS256 JWT (`SignJWT`, `importPKCS8`) for Google's service-account token request and works on Bun. Checked in Bun 1.4.4 on Windows, from source and from a `bun build --compile` binary: `﻿nombre;precio;disponible` with a quoted `"Queso; fresco"` and a quoted embedded newline parsed to the right cells with delimiter `;`; a tab file guessed `	`; a 2048-bit RSA key signed a three-part JWT. Cost: two dependencies.
- **Option C** `csv-parse` 7.0.3 (MIT, last published 2026-09-25) and `google-spreadsheet` with its `google-auth-library` peer. `csv-parse` has no delimiter guessing, so Deputy would write that part by hand. For the Google side Orders measured three ways (Orders TP-03, TD-5): `google-spreadsheet` with `google-auth-library` is 26 installed packages and 27 MB, `@googleapis/sheets` is 45 packages and 14 MB, and `jose` is 1 package; all three compile with `bun build --compile`. Neither library does anything Deputy needs beyond the one token request and a few calls that `jose` and `fetch` cover.

Chosen: Option B. Papaparse guesses the delimiter, which Option C's `csv-parse` does not, and that is the first step of D22. `jose` is the smaller and audited way to sign the one token Deputy needs; Option C's libraries are 26 and 45 packages for one token request and a few calls. Deputy writes only what no library does: the decimal and column detection below. Knowledge's spreadsheet catalog adapter and Orders' spreadsheet adapter share one Google client in `src/adapters/google/` (the `jose` token request and the HTTP calls, with its quota handling), so the sign-in exists once.

Catalog import (D21, D22), done by Knowledge's catalog reader with no header-alias list in any language:
1. Delimiter: papaparse's guess. A file where the guess leaves one column is shown to the owner for correction.
2. Number format, per price column: strip currency symbols, letters and spaces (including no-break and thin spaces), then look at the last separator of each value. A comma or a period followed by one or two digits is the decimal mark (`12,50`, `1.234,5`, `1,234.50`). A separator followed by exactly three digits is a thousands mark (`1.234`) when another value in the column shows the other mark, otherwise it is ambiguous. The column's format is the majority of the unambiguous values. Contradicting values, or only ambiguous ones, are shown to the owner as a question ("does 1.234 mean 1234 or 1.234?"); Deputy never guesses a price.
3. Column roles, from the content and not the header text: name (the leftmost text column with mostly distinct values), price (numeric), availability (few distinct values, or yes/no-like), unit (short repeating text), currency (ISO 4217 codes or symbols such as `$` or `€`), description (long text). The header text is shown to the owner next to three sample values per column, so the owner reads the mapping in their own language.
4. The mapping (delimiter, decimal and thousands marks, role per column, and the header row itself) is shown to the owner. The owner confirms or corrects it once, through the existing proposal flow (`propose_change`, `apply_change`, with the owner's words, FR-KNOWLEDGE-01-9 to 01-11). The confirmed mapping is stored as Knowledge's `catalog_mapping` setting. Until it is confirmed, `find_catalog_items` refuses with the code `catalog_mapping_unconfirmed` and prices are not read. When the header row differs from the stored one (a column added, renamed or moved; the check is an equality of the cells, so no hash is needed), the mapping is proposed again; a stale mapping is never applied to a changed file.
5. Currency (D21): Setup suggests a currency from the owner's country and the owner confirms it; it is stored as `currency`. An optional per-product currency column overrides it for that row. A row with a price but no currency in either place is "to be confirmed", not priced in a guessed currency.
6. A blank or unreadable price or availability is "to be confirmed" (C13), as before.

Tests: the same five-product catalog in four files, comma with a dot decimal, semicolon with a comma decimal and `1.234,50` thousands, tab-separated with a BOM, and a Spanish-header file and an Arabic-header file with different column orders; each detects the same mapping (the header text is ignored by detection), and only after confirmation does `find_catalog_items` return prices; an ambiguous column raises the question and returns no price; a changed header row asks again; a per-product currency column overrides the setting; a signed JWT from `jose` verifies against the public key and has the claims Google requires (issuer, scope, audience, issued at, expiry of at most one hour). Live check at launch: one real Google service-account token request from the compiled binary. Recorded in ADR-012.

## Architecture

Style: ports and adapters (TD-0). Each slice is a bounded context with four folders. The drawing shows one hexagon per slice, its ports on the edge, and the adapters outside.

```mermaid
flowchart LR
  Agent["Agent: Claude Code, Codex, Cursor, Gemini CLI"]
  Kapso["Kapso API"]
  Sched["Scheduler adapter"]
  Hook["Live-delivery HTTP listener, optional"]
  Cli["Command line adapter: deputy config, deputy secrets"]
  Cfg["config.json, OS credential store, secrets.env fallback"]
  MCP["MCP server adapter: tools to use cases"]
  Chan["Claude channel notifier adapter, optional"]
  subgraph IntakeCtx["Intake context"]
    InI(["inbound ports"])
    IntakeCore["domain and application"]
    InO(["outbound ports: MessageRepository, Provider, OwnerLease, Clock"])
    InI --> IntakeCore --> InO
  end
  subgraph InboxCtx["Inbox context"]
    BxI(["inbound ports"])
    InboxCore["domain and application"]
    BxO(["outbound ports: IgnoreRepository, MessageReader, CatchUpRunner, DraftsQuery, OrdersQuery"])
    BxI --> InboxCore --> BxO
  end
  subgraph DraftsCtx["Drafts context"]
    DrI(["inbound ports"])
    DraftsCore["domain and application"]
    DrO(["outbound ports: DraftRepository, DraftLog, Sender, ChatFreshness, OrderPreparer, OrderChanger, UnitOfWork"])
    DrI --> DraftsCore --> DrO
  end
  subgraph NotifyCtx["Notify context"]
    NoI(["inbound ports"])
    NotifyCore["domain and application"]
    NoO(["outbound ports: NoticeRepository, Notifier, WaitingCounts"])
    NoI --> NotifyCore --> NoO
  end
  subgraph OthersCtx["Knowledge, Orders, Setup contexts: same four folders"]
    OtI(["inbound ports"])
    OtherCore["domain and application"]
    OtO(["outbound ports: repositories, catalog and profile readers, secrets check"])
    OtI --> OtherCore --> OtO
  end
  Agent --> MCP
  MCP --> InI
  MCP --> BxI
  MCP --> DrI
  MCP --> OtI
  Sched --> InI
  Sched --> NoI
  Hook --> InI
  Cli -.->|pending-change row, no lease| SqliteA
  Cli --> Cfg
  InO --> SqliteA["SQLite repositories"]
  InO --> ProvA["Provider adapters: Kapso, dev"]
  ProvA --> Kapso
  Kapso -.->|signed webhook| Hook
  DrO --> SqliteA
  DrO -.->|SendText, CatchUpChat via published port| InI
  DrO -.->|PrepareOrder, RecordOrder, ChangeOrder, DeleteOrder| OtI
  BxO --> SqliteA
  BxO -.->|ReadChat, ListChats, GetSyncStatus, CatchUp| InI
  BxO -.->|published inbound ports| DrI
  BxO -.->|published inbound ports| OtI
  NoO -.->|events and published ports| InI
  NoO --> Chan
  Chan -->|counts only| Agent
  OtO --> SqliteA
  OtO --> Files["Owner files and spreadsheet adapters"]
  Main["src/main.ts: composition root"] -.->|wires| MCP
```

Moved verbatim to [TP-architecture.md](../tp-detail/TP-architecture.md).

## Information

Moved verbatim to [TP-information.md](../tp-detail/TP-information.md).

## Interfaces

Moved verbatim to [TP-interfaces.md](../tp-detail/TP-interfaces.md).

## Threat model

Moved verbatim to [TP-threat-model.md](../tp-detail/TP-threat-model.md).

## Testing

Moved verbatim to [TP-testing.md](../tp-detail/TP-testing.md).

## Risks

Moved verbatim to [TP-risks.md](../tp-detail/TP-risks.md).

## Open questions

Closed by the owner (docs/DECISIONS.md):
- D15: the L6 scrub is one narrow, tested exception to the append-only drafts log. (This closes the old question about the L6 scrub.)
- D16: a second session is read-only, with no drafting.
- D17: v1 ships as a compiled binary (`bun build --compile`).
- D18: live checks (the 30-minute idle timeout, `instructions` delivery, `last_active` on an echo) run first on Claude Code, then Codex.
- D19: sensitive settings change only through the owner's terminal command; Setup shows the command, waits and confirms (TD-8).
- FR-INTAKE-03-1 stays as written. The inbox window (D3) never limits catch-up; the TP was fixed to match (TD-5).

For the owner:

1. The package name stays open until launch (D17). `deputy` is taken on npm (PRODUCT open question 4).

For later TPs:

2. Which Kapso webhook event carries an owner echo (PRODUCT open question 1). It only matters for live delivery.
3. How learning separates facts, tone and one-customer cases (PRODUCT open question 5). Storage fits any answer.
4. Where approvals live so Codex sees the same state (PRODUCT open question 2). The database file answers it for one machine and one data folder.
5. The retention window of the provider (FR-INBOX-01-7) and the exact Kapso field that reports it.
