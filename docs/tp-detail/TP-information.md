# TP: Information

Part of [TP.md](../tp/TP.md). Moved verbatim from there; nothing changed.

## Information

Aggregates and repositories. Each aggregate has one repository port in its slice (`ports/`) and a SQLite adapter (`adapters/sqlite/`). The tables below are the storage of these aggregates, not shared across slices.

| Slice | Aggregate (root and parts) | Repository port | Tables |
|---|---|---|---|
| Intake | `Message` (one per message, keyed by provider and provider message id, holding a `ChatId`; with versions and the send id it matched; the unit of storage). `Chat` is not a container of messages: it keeps only its state (last customer message, last owner or Deputy answer, source of that answer), recomputed from the messages inside the store transaction (the `MessageStored` event is only a hint to other slices) | `MessageRepository`, `ChatStateRepository` | `messages`, `message_versions`, `outgoing`, `chats` |
| Intake | `SyncState` (status, provider-time mark) and `RejectionNote` | `SyncStateRepository`, `RejectionRepository` | `catchup_status`, `rejections` |
| Intake | `OwnerNumbers` (set by Setup through Intake's inbound port) | `OwnerNumbersRepository` | `owner_numbers` |
| Inbox | `IgnoreList` (entries and their log) and `InboxSettings` (window) | `IgnoreRepository`, `InboxSettingsRepository` | `ignored_chats`, `ignore_log`, `settings` (inbox keys) |
| Drafts | `Draft` (text, state, approvals) and `DraftLog` (append-only entries) | `DraftRepository`, `DraftLogRepository`, `UnitOfWork` | `drafts`, `approvals`, `drafts_log` |
| Notify | `NoticeState` and `NotifySettings` | `NoticeRepository`, `NotifySettingsRepository` | `notice_state`, `settings` (notify keys) |
| Knowledge | `Proposal`, `LearnedItem`, `KnowledgeLog`; `Profile` and `Catalog` are owner files read and written through ports, not aggregates | `LearnedItemRepository`, `ProposalRepository`, `ProfileStore`, `CatalogStore` | `lessons`, `proposals`, `knowledge_log`, `lesson_sources`, `catalog_seen`, `knowledge_state`, `knowledge_wipes`; files; spreadsheet |
| Orders | `Order` (items with snapshots, history, message links) and `DeletedMark` | `OrderRepository` (SQLite or spreadsheet adapter) | `orders`, `order_items`, `order_history`, `order_messages`, `order_deleted`, `orders_instance`, `order_outbox`, `order_pending_deletes`, `order_store_switch` |
| Setup | `SetupProgress` | `SetupProgressRepository` | `setup_progress` |

A repository saves a whole aggregate in one transaction. A step that spans two aggregates of one slice (the send step: `Draft` plus `DraftLog`) uses the slice's `UnitOfWork` port. Nothing writes across slices in one transaction.

Database tables (one SQLite file in the data folder, schema versioned with `PRAGMA user_version` and ordered `.sql` files, TD-3):

| Table | Holds | Key points | FRs |
|---|---|---|---|
| `lease` | one row: token, holder start, heartbeat (TD-2) | read and written by the `OwnerLease` adapter only | FR-DRAFTS-02-12 |
| `chats` | chat state: last customer message, last answer and its source, last unattributed message time | recomputed inside the store transaction | FR-INTAKE-04-13 |
| `messages` | chat, sender number, text, normalized text (`text_norm`, indexed, for `IsCustomerText`), type, readable, transcript, sent time, stored time, provider, provider message id, source, history flag, dev flag, edited flag, group or unknown mark | unique `(provider, provider_message_id)`; ordered by sent time then arrival | FR-INTAKE-02-4, FR-INTAKE-02-7, FR-INTAKE-02-8 |
| `message_versions` | earlier text of an edited message | kept with the message | FR-INTAKE-02-12 |
| `outgoing` | send id, chat, pending text, created time, provider message id once matched, state | `SendText` writes it before the provider call; `FindOutgoing` matches by it | FR-INTAKE-04-6, FR-INTAKE-04-13 |
| `catchup_status` | one row per provider: status, reason, last attempt, last success, newest stored message, one provider-time mark per sweep (conversations; outbound), and the outbound resume cursor and window | read by any slice | FR-INTAKE-03-6 |
| `rejections` | time, reason, no content | | FR-INTAKE-02-2 |
| `owner_numbers` | normalized number, label, added at, owner's words | changes by explicit command only | FR-INTAKE-04-14, FR-SETUP-02-8 |
| `drafts` | number (shared), kind (reply or order), chat, text, state (waiting, held, sending, recording, sent, recorded, failed, unknown, rejected; never "approved", which is one step with "sending"), made at, latest message time at that moment, shown-since-last-change flag, order payload | one open reply and one open order per chat | FR-DRAFTS-01-1, FR-DRAFTS-01-7 |
| `approvals` | draft number, exact text, text hash, owner's words, time, used flag | one use only | FR-DRAFTS-02-3, FR-DRAFTS-02-4 |
| `drafts_log` | entry id, time, event, draft number, proposed and final text, owner's words, reason | append-only by trigger; one scrub path for L6, which also clears order text in `drafts` and `approvals` | FR-DRAFTS-04-1, FR-DRAFTS-04-3, FR-DRAFTS-04-4 |
| `ignored_chats`, `ignore_log` | chat; each change with the owner's words | Inbox is the only owner | FR-INBOX-03-10, FR-INBOX-03-11 |
| `settings` | key, value, changed at | see list below | FR-INTAKE-03-21, FR-NOTIFY-02-1, FR-INBOX-01-6 |
| `notice_state` | last delivered time, the failure counters and the announced outage | pending counts live in memory only; the notice carries counts and no content | FR-NOTIFY-01-7, FR-NOTIFY-03-6 |
| `lessons`, `proposals`, `knowledge_log` | lesson wording, links to chat and draft log entry, proposal old and new values, each confirmation with the owner's words | |
| `lesson_sources`, `catalog_seen`, `knowledge_state`, `knowledge_wipes` | pointers into the drafts log (no text copied); the catalog fingerprint and the time a change was first seen; `log_cursor`, `seed_revision` and `seed_fingerprint`; each wipe with the owner's words and a per-part result, no content | `knowledge_wipes` is the one table a wipe keeps | FR-KNOWLEDGE-02-1, FR-KNOWLEDGE-01-14, FR-KNOWLEDGE-03-4 | FR-KNOWLEDGE-02-5, FR-KNOWLEDGE-02-7, FR-KNOWLEDGE-01-9 |
| `orders`, `order_items`, `order_history`, `order_messages`, `order_deleted`, `orders_instance`, `order_outbox`, `order_pending_deletes`, `order_store_switch` | order, item snapshots (name, unit, price), old and new values, message ids, deleted mark (id and time only) | idempotent on `installId:draftNumber` (`installId` is a random id made once per data folder, so a restored copy of the folder does not collide) | FR-ORDERS-01-7, FR-ORDERS-01-14, FR-ORDERS-02-6, FR-ORDERS-02-10 |
| `pending_changes` | key, value, typed command, time, applied time | written by the command line without the lease; applied by `ApplyPendingChanges` | FR-SETUP-02-8, FR-INTAKE-04-9 |
| `setup_progress` | step, state, started and passed times, provider wait | | FR-SETUP-01-6, FR-SETUP-01-9 |

Each slice reads and writes only its own settings keys through its own settings repository, though the file has one `settings` table. Keys by owner: Intake `catch_up_minutes`, `country`; Inbox `pending_window_days`; Notify `batch_minutes`, `reminder_minutes`, `reminders_paused`, `quiet_periods`, `time_zone`, `notices_on`; Orders `orders_store`; Knowledge `catalog_store`, `currency`, `catalog_mapping`. `provider`, `receiving_mode` and `push_on` are not in the database: they are connection settings in `~/.deputy/config.json` (TD-8).

Owner files (the owner edits them by hand):

| File | Format | Notes | FRs |
|---|---|---|---|
| `business/profile.md` | Markdown with fixed headings | read on every call, never cached | FR-KNOWLEDGE-01-1, FR-KNOWLEDGE-01-8 |
| `business/catalog.csv` | table file (any delimiter, number format and column order; read with papaparse; the owner confirms the detected mapping once, TD-12) | blank price or availability, or a price with no currency, returns "to be confirmed" (fixes C13); `currency` setting from Setup, optional per-product currency column | FR-KNOWLEDGE-01-3, FR-KNOWLEDGE-01-4 |
| OS credential store (`Bun.secrets`, service `deputy`); fallback `~/.deputy/secrets.env` | store entry; `KEY=value` in the file, mode 0600 on POSIX | provider key, webhook secret, Google service account path; the file exists only when the store is unavailable (TD-8) | FR-SETUP-03-2 |
| Owner spreadsheet | tabs Catalog, Orders, Order history | optional | FR-KNOWLEDGE-01-13, FR-ORDERS-03-2 |

Write discipline. SQLite runs with WAL and `busy_timeout`. Every multi-row change is one transaction. Only the owner process writes (TD-2); a read-only process also opens the database read-only, as a second line of defense behind the `OwnerLease` check. The data folder is gitignored.
