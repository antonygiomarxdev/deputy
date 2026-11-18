# Codebase inventory against the FRDs

Snapshot of branch `docs/prd`, 2026-11-17. `bun test`: 8 pass, 0 fail. `bun run typecheck`: clean. Line counts are `wc -l`.

Shape in one line: a push-only reply bot. Webhook in, `notifications/claude/channel` to the agent, agent calls `reply` and Deputy sends at once. No draft, no go, no catch-up, no pull from the provider, no inbox, no notice batching.

## Inventory

| Module | What it does | Lines | Tests that cover it |
|---|---|---|---|
| `src/server.ts` | MCP server (stdio) plus HTTP listener. Instructions string (with business.md inlined), 8 tools (`reply`, `history`, `get_catalog`, `create_order`, `list_orders`, `handoff`, `resume`, `notify_owner`), permission relay, owner yes/no parse, inbound pipeline (dedup, record, pause check, push), `/health`, `/dev/events` SSE, `/webhook`. | 332 | `e2e.test.ts` (dev flow, permission relay, meta, kapso). Not covered: `/health`, `lang=es` text, `echoPauseMin=0`, body-too-large. |
| `src/config.ts` | Hand-rolled `.env` loader (no dep), `config` object: port, host, provider, store, owners, echoPauseMin, permissionRelay, lang, businessDir, dataDir. `req()` throws on missing key. | 42 | Indirect (e2e sets env per spawn). |
| `src/types.ts` | `Inbound`, `Echo`, `WebhookResult`, `IncomingRequest`, `Provider` (`handleWebhook`, `sendText`, `markRead?`), `Product`, `Order`, `Store`. | 72 | Type-checked only. |
| `src/conversations.ts` | Per-chat JSONL history, `state.json` (pauses, last 1000 seen ids), dedup, pause/resume with expiry. Chat file name = digits of chat id. Sync fs. | 72 | E2E only (dedup, pause, history). No unit test. |
| `src/providers/graph.ts` | Graph-API sender (`sendText` split at 4000, `markRead`), `verifyHmac`, `graphMessageToInbound` (type to text mapping, drops reactions). | 116 | `splitText` unit test; HMAC and mapping through e2e meta/kapso. |
| `src/providers/meta.ts` | Meta Cloud API provider: GET verify, signature check, messages, `smb_message_echoes` as echoes. | 69 | e2e meta test. |
| `src/providers/kapso.ts` | Kapso provider: webhook only (HMAC `x-webhook-signature`, event `whatsapp.message.received`), sends through Kapso Graph proxy. No REST pull, no history. | 53 | e2e kapso test. |
| `src/providers/dev.ts` | Dev provider: POST `/webhook` makes inbound or echo, SSE of outbound. | 41 | e2e dev test. |
| `src/providers/index.ts` | Registry `meta`, `kapso`, `dev`. | 17 | Indirect. |
| `src/store/csv.ts` | CSV parse/format, `ORDER_COLS`, order row mapping (items flattened to `"10 nacatamal; 2 cider"`), catalog header aliases en/es. | 89 | `unit.test.ts` (3 tests) plus e2e. |
| `src/store/local.ts` | Catalog from `business/catalog.csv`, orders append-only in `data/orders.csv`. | 27 | e2e (create + list). |
| `src/store/sheets.ts` | Google Sheets via service account JWT (hand-rolled RS256), tabs Catalog/Orders, read and append only. | 72 | None. |
| `src/store/index.ts` | Registry `local`, `sheets`. | 15 | Indirect. |
| `operator/` | Locked-down Claude Code profile: `.mcp.json` (spawns `bun ../src/server.ts`), `settings.json` (allow-list of the 8 tools, deny Bash/Read/Write/Edit/Glob/Grep/Web/Task/Agent), `PROMPT.md`. | 44 | None (live tests are manual, see memory `live-testing-operator`). |
| `scripts/operator.sh` | Runs `claude --dangerously-load-development-channels server:deputy --strict-mcp-config --setting-sources project --tools "" --permission-mode manual`. | 12 | None. |
| `scripts/start.sh` | tmux wrapper (needs tmux, so not on Windows). | 9 | None. |
| `scripts/simulate.sh` | curl a fake customer to `/webhook`. | 9 | None. |
| `test/e2e.test.ts` | 5 tests: dev flow, permission relay, meta, kapso. Spawns the server over stdio with a temp data dir. | 225 | n/a |
| `test/unit.test.ts` | 4 tests: CSV catalog en/es, order round-trip, `splitText`. | 35 | n/a |
| `business/`, `examples/` | `business.md` (free text profile) and `catalog.csv` template; filled example. | n/a | Catalog parse in unit tests. |

Not present: any ledger, draft, approval, intake store, catch-up, inbox, notice scheduler, setup status, lessons, order change history, export, wipe, or REST client for Kapso. `docs/research/kapso.md` exists (not read in depth here).

## Reuse map

| FRD | Existing code that already does part of it | Gap |
|---|---|---|
| drafts/FRD-01 draft lifecycle | None. Closest: `reply` tool `server.ts:112` and `convs.add` `conversations.ts:46`. | New draft store with ids (shared numbering L5), states (waiting/approved/held/sending/sent/failed/rejected), one open reply and one open order per chat, text edit voids approval, dev-message refusal, "which chats have a draft" query for Inbox. |
| drafts/FRD-02 owner's go | None. `VERDICT_RE` `server.ts:178` and `handleInbound` `server.ts:184-193` parse "yes abcde" from the owner's number; that is the opposite model (a number-sourced yes/no for a tool permission, not a named-draft go). | Approval record (draft id, shown text, owner's words), refuse on text mismatch, one-shot approval, atomic mark-used-before-send (02-12), `send_draft` as the only send path. Order-go (02-9/02-10) on top. |
| drafts/FRD-03 safe send | `GraphSender.sendText` `graph.ts:21-35` (chunking, error on non-2xx). Echoes as a signal: `handleWebhook` echoes `meta.ts:55-60`, handled `server.ts:285-289`. | Pre-send catch-up, "owner answered or customer wrote again since draft" check from Intake source and time, hold with three choices, failure and outcome-unknown states (no retry), resolve unknown against Intake (03-13), send id handed to Intake. `sendText` today returns only `{id}` of the last chunk and throws on partial failure with no record of which chunks went. |
| drafts/FRD-04 drafts log | `Conversations.add` is an append-only JSONL, same idea. | Append-only event log with entry ids, proposed and final text, approval entries carrying owner words, "every sent has an approval" check, per-chat view, order entries with delete scrub (L6: owner words replaced by "deleted"; that makes the log not strictly immutable, which needs an explicit ADR). |
| inbox/FRD-01 pending detection | `history()` `conversations.ts:51` and `from` author per entry. | Pending rule over message source and time, window N (D3), history flag, dev/group/unknown exclusions, ignore list, provider-held cap. All new. Current `Entry` has no source field beyond author, no provider id, no sent-time. |
| inbox/FRD-02 summary | None. `/health` `server.ts:263` is a count only. | `inbox` tool: trigger catch-up and wait, warning on failure, grouping with D4 precedence, freshness header, excerpts labeled as customer text, "already answered" group, 4 counts lines. |
| inbox/FRD-03 ignore chat | `pause`/`resume` `conversations.ts:56-70` is similar (per-chat flag in `state.json`) but means "agent must not reply", not "hide from inbox". | Separate ignore list, owner-command-only with logged words (L4), disambiguation, counts, survives restart. Do not reuse pause for it. |
| intake/FRD-01 providers | Provider interface `types.ts:37-42`, registry `providers/index.ts`, dev provider, `GraphSender`, `graphMessageToInbound`. | v1 allows only `kapso` and `dev`: `meta` must go (01-1 refuses other values). Dev must also fake "missed" messages and unreadable types, transcripts, history flag, out-of-order. Dev-only entry points must be absent under Kapso (01-9). Today `/webhook` accepts unauthenticated dev POSTs only because provider is dev; keep that gate. Provider interface needs `fetchMessages(since, cursor)`. |
| intake/FRD-02 receive and store | Dedup `convs.seen` `conversations.ts:36` (global list of 1000 ids, trimmed to 500). HMAC check `graph.ts:57`. Type-to-text `graph.ts:75`. | Durable message store keyed by (provider, provider id) with chat, sender, text, type, readable, transcript, sent time, stored time, source, history flag, edited versions, group/unknown marks; ordered by sent time; rejection notes without content; "message stored" signal. Today the trimmed `seen` list will re-admit old ids and there is no stored record of non-text types except as the string `[image]`. |
| intake/FRD-03 catch-up and history | None. Kapso provider has no REST client. | Everything: pull with auth, paging, rate-limit backoff, status (complete/failed, times), gap detection, timeout, periodic timer, owner-triggered, first-sync history flagging. Needs the Kapso REST contract (see `docs/research/kapso.md`). |
| intake/FRD-04 owner echoes | `isOwner` `server.ts:34`, `config.owners`, Meta echoes `meta.ts:55`, `echoes` into `convs.add(..., "owner_app")` `server.ts:285`. | Source decided at store time from numbers plus Deputy send ids (L2), reclassify "owner from the app" to "sent through Deputy" on later match, number normalization (digits with country code; today `file()` strips non-digits but `owners.has(wa)` compares raw strings), Kapso origin field `business_app`. Echo also currently pauses the chat for `echoPauseMin` (see Conflicts). |
| knowledge/FRD-01 profile and catalog | `business.md` read once at start `server.ts:36-39` and inlined into instructions; `get_catalog` `server.ts:127`; `rowsToCatalog` with aliases `csv.ts:56`; local and sheets stores read live. | Profile must be read per call (01-8 says a save applies next draft; today needs a restart). Catalog name lookup tool returning "to be confirmed" for empty price or availability (today `price: null` and `available: true` by default when blank). Proposal-then-apply with owner words (01-9..11), catalog/profile saved-times, "catalog changed" mark on drafts, sheets write (today append-orders only). |
| knowledge/FRD-02 learned knowledge | None. | Lessons store, proposal ids, confirm-with-exact-wording, link to chat and draft entry ids, list/edit/delete, return all lessons when drafting. |
| knowledge/FRD-03 export and wipe | None. | Export of profile + catalog + lessons, wipe with confirmation and owner words, sheets disconnect, proposal and apply-log deletion. |
| notify/FRD-01 batched notice | `mcp.notification({method:"notifications/claude/channel"...})` `server.ts:196` pushes each message individually, which is what the FRD replaces. `notifyOwners` `server.ts:98` sends to the owner's WhatsApp. | Batching timer, counts-only notice into the agent session (not WhatsApp), reminder timer, new-message set tracking per delivered notice, worst-case delay bound, catch-up-failed variant. Reuse only the channel-notification call shape. |
| notify/FRD-02 owner controls | None. | Batch period, reminder period, pause/resume reminders, quiet periods by local clock, on/off, reads ignore list from Inbox. Persisted settings (no settings store exists besides `.env`). |
| notify/FRD-03 harmless and reliable | Echo detection `server.ts:285`. | Use Intake source (not echoes), failed-notice accounting, unreachable-provider notice. |
| orders/FRD-01 record order | `create_order` tool `server.ts:130-148`, `Order` type, `ORDER_COLS`, `orderToRow`. | Order draft (not direct write), catalog ref or "not in catalog" per item, required-detail check, snapshot of name/unit/price per item, computed total or "to be confirmed", idempotency on the draft id, message ids linked, "chat has an order" and "message recorded as order" queries for Inbox. Today `create_order` writes immediately, trusts `a.items` unvalidated (`items: a.items`), and takes `total` from the agent. |
| orders/FRD-02 manage orders | `list_orders` `server.ts:150` (status filter only). `Order.status` string. | Filters by customer and date wanted, status set, change with old/new history, cancel, delete with "deleted" mark, reject non-identifying commands, unreadable-row handling. Local CSV is append-only with no update or delete path. |
| orders/FRD-03 storage and export | `local` and `sheets` stores. Both implement `Store`. | Update/delete in both backends, history storage (CSV has no place for it), unreachable behavior (sheets `api()` throws; fine), storage-switch notice, export with history, partial export flag. |
| setup/FRD-01 guided flow | None. `scripts/operator.sh` and `start.sh` are the manual equivalent. | Setup status tool, per-step checks, persisted progress, timing record, step-1 check that the tool list holds what later steps need. |
| setup/FRD-02 connect number | `.env` keys `KAPSO_*`, `DEPUTY_OWNERS`; `config.owners`. | Number/app questions, costs shown from provider, receiving-mode choice, owner-number registry as persisted data (today only `.env`). |
| setup/FRD-03 credentials | `config.ts` `.env` loader keeps secrets out of chat (the agent never sees them). | Owner enters secrets out of band (D6): a command or file the owner runs, partial echo (last four), secrets check (present and accepted) without value, refusal to loosen agent permissions. |
| setup/FRD-04 profile, test, finish | `examples/`, `business/` templates; `dev` provider and `simulate.sh` (test mode). | Guided profile/catalog interview with confirmation, round-trip test that goes through a draft and go, test-to-real switch that drops dev data from counts, completion summary. |

## Conflicts

Existing behavior that contradicts an FRD or a decision. Each needs a TP decision (remove, replace or gate).

| # | Existing behavior | Where | Contradicts |
|---|---|---|---|
| C1 | `reply` sends to the provider immediately, no draft, no approval. It is the agent's direct send path. | `server.ts:112-118`; allowed without prompt in `operator/.claude/settings.json:5-12` (`mcp__deputy__reply`) | D1, D11, FR-DRAFTS-02-5/02-7 ("no way to send except an approved draft"), principle 1. Highest priority. |
| C2 | Instructions tell the agent "ALWAYS answer with the reply tool", "Orders: ... then call create_order", and `notify_owner`. Agent answers on its own. | `server.ts:50-62` | D1, D2, FRD-DRAFTS-02, FRD-ORDERS-01 (order only after go). |
| C3 | `create_order` writes straight to the store. | `server.ts:130-148`; allowed in `settings.json:8` | D2, FR-ORDERS-01-4/01-11 (record only after a go; idempotent on draft id). |
| C4 | `notify_owner` sends text to the owner's WhatsApp number through the provider, and any model-written text. | `server.ts:97-109, 168-171`; tool at `server.ts:90-94` | FR-NOTIFY-01-1/01-5 (notice goes to the agent session, counts only), D5, FR-NOTIFY-03-3. It is also an extra send path to any number in `owners` and is not a draft. The FRD notice is a channel notification, not a WhatsApp message. |
| C5 | Permission relay: forwards Claude Code permission prompts to the owner's WhatsApp, and the owner's "yes abcde" over WhatsApp answers them. | `server.ts:171-182, 188-196`; capability `server.ts:68` | D1/D11 and FR-DRAFTS-02-6/02-7 (no permission dialog replaces the go; only the owner's words in the agent conversation count). Also a second trust channel: any message from an owner number matching `VERDICT_RE` is consumed before it reaches the agent. Decide: delete, or keep only as an unrelated convenience that cannot approve a send. |
| C6 | `handoff` and `resume` tools plus echo-triggered pause (`echoPauseMin`, default 30) gate whether the agent sees a message at all. A paused chat's customer messages are saved but never pushed. | `server.ts:150-160, 80-84, 285-289`; `conversations.ts:56-70` | FR-INBOX-01-3 / FRD-INTAKE-04 model: pending is computed from stored sources, not from pause flags. FR-INBOX-03 ignore list is a different concept. Echo no longer needs to pause; the "owner answered since draft" check (FR-DRAFTS-03-3) replaces it. |
| C7 | Push per message: every customer message becomes one `notifications/claude/channel` carrying the customer text and name. | `server.ts:196-203` | FR-NOTIFY-01-5 (notices carry counts only, no text, no name) and D5. Customer text in a channel event is also an injection vector the PRD wants removed from the push path (the agent should read customer text only through the labeled inbox view). |
| C8 | Receiving is webhook-only. Meta and Kapso both need a public URL. No periodic pull. | `server.ts:266-292`; `providers/kapso.ts:25-51` | D12, FRD-INTAKE-03 (catch-up default, no public address). |
| C9 | `meta` provider is registered and documented. | `providers/meta.ts`, `providers/index.ts:8` | FR-INTAKE-01-1 (v1 accepts only Kapso and dev; other values refused at start). |
| C10 | Dev provider messages are treated like real ones forever; no `dev` mark on stored data; `/webhook` accepts raw dev POSTs and `/dev/events` exposes outbound text over HTTP when provider is dev. | `providers/dev.ts`; `server.ts:268` | FR-INTAKE-01-10 (dev messages marked, never pending, notified or drafted once provider is not dev). The provider-gating of dev routes (01-9) is already true by construction (they only exist while provider=dev); keep it. |
| C11 | Owner identity is the raw `from` string compared to `config.owners`; no normalization. A message from an owner number goes to the agent as `role="owner"` and is treated as instructions ("Only messages with role=owner come from the owner"). | `server.ts:34, 184, 205`; instructions `server.ts:46` | FR-INTAKE-04-14 (normalize), L2/FR-INTAKE-04-2 (a message from an owner number is stored as a message with source, not a live command channel). Under D1 the owner's go comes in the agent conversation, not as a WhatsApp message from the owner's number. Decide whether WhatsApp messages from the owner number ever reach the agent as instructions (D8 says phone access is the agent's own remote access). |
| C12 | `business.md` loaded once at start into instructions; later edits not seen until restart. | `server.ts:36-39` | FR-KNOWLEDGE-01-8 (applies from the next draft, no restart). |
| C13 | Catalog: blank availability defaults to available; blank price is `null` (the agent is told in prose to say "to be confirmed"). | `csv.ts:63-71` | FR-KNOWLEDGE-01-4 (Deputy returns "to be confirmed" for empty or unknown price and availability, never fills in a value). Blank availability should become unknown, not true. |
| C14 | Orders: no change/delete, `status` only ever "new"; CSV append-only; orders store `phone` and items as a flat string; total taken from the agent; no snapshot of price. | `server.ts:130-148`; `csv.ts:30-53`; `store/local.ts:20-26` | FRD-ORDERS-02/03 (change with history, delete, snapshot, export), FR-ORDERS-01-15 (Deputy computes total). Storage format must change (see Storage). |
| C15 | Dedup list is global, 1000 ids trimmed to 500; trimmed ids can reappear. | `conversations.ts:36-41` | FR-INTAKE-02-7 (a repeated id is never stored twice, whether live or catch-up). A pull-based catch-up will replay old ids, so the trim becomes a real bug. |
| C16 | Chat id is the sender's `from`; the chat history file is `digits-only.jsonl`. Two raw ids that differ only by punctuation collide; group ids (not digits) collapse into "unknown". | `conversations.ts:25-27` | FR-INTAKE-02-13 (group messages stored and marked, not dropped or merged) and FR-INTAKE-04-14. |
| C17 | `reply` and `notify_owner` log outbound as author `deputy` at send time, before the provider echo is seen. No source and no provider id on the entry. | `conversations.ts:46`; `server.ts:114-116` | FR-INTAKE-04-6/07/13 (record once as "sent through Deputy" linked to the send id; the later provider report is not stored twice). |
| C18 | `operator/.claude/settings.json` allows all 8 tools without prompts and `operator.sh` runs `--permission-mode manual`. | `settings.json:3-14`; `operator.sh:11` | Not a contradiction by itself, but the allow-list must be rewritten with the new tool set: `send_draft` must stay out of the auto-allow list unless the TP decides the Deputy-side go check is the only gate (D11 says the agent's permission dialog neither replaces nor widens the go). |
| C19 | `lang` setting (en/es) only used for the permission relay text. | `config.ts:38`, `server.ts:40-46` | None. Dies with C5. |
| C20 | README and CLAUDE.md describe the push-and-answer model (`README.md`, `README.es.md`, `CLAUDE.md` layout). | docs | Must be updated with the code; both READMEs kept in sync. |

## Storage today

Everything under `DEPUTY_DATA_DIR` (default `data/`, gitignored) unless noted.

| File | Format | Written by | Read by |
|---|---|---|---|
| `data/conversations/<digits>.jsonl` | JSONL, one `{t, from, text}` per line; `from` in `customer|deputy|owner|owner_app`. No ids, no sent time, no type, no source, no provider id. | `Conversations.add` (append) from inbound, `reply`, `notify_owner`, echoes | `history` tool via `Conversations.history` (reads whole file, slices tail) |
| `data/state.json` | JSON `{paused: {chat: epochMs|null}, seen: [ids...]}`. Rewritten whole on each `seen()` call. | `Conversations.save` | `Conversations` constructor, `/health` (`pausedNow`) |
| `data/orders.csv` | CSV, header `id,created_at,phone,customer,items,fulfillment,address,due,total,notes,status`; `items` is `"10 nacatamal; 2 cider"` | `store/local.ts` `createOrder` (append) | `list_orders` (full read), no other reader |
| `business/business.md` | Free text, read once at start | owner by hand | `server.ts:36` into the instructions string |
| `business/catalog.csv` | CSV with en/es header aliases | owner by hand | `get_catalog` (live read on each call) |
| `.env` (repo root) | `KEY=value` lines | owner by hand | `config.ts` loader at startup. Holds secrets (`KAPSO_API_KEY`, `KAPSO_WEBHOOK_SECRET`, `META_ACCESS_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_FILE` path, ...). |
| Google service-account JSON | Path from `GOOGLE_SERVICE_ACCOUNT_FILE` | owner | `store/sheets.ts` |
| Google Sheet tabs `Catalog`, `Orders` (optional store) | Sheet rows; Orders header written on first append | `sheets.ts` `createOrder` (append) | `sheets.ts` `catalog()`, `orders()` |

Nothing yet for: messages with source and provider id, drafts, approvals and the drafts log, ignore list, owner-number registry, notice settings, lessons, proposals, order history, setup progress, catch-up status, rejection notes. Writes are not atomic (`writeFileSync` on `state.json`; no temp-and-rename, no lock). FR-DRAFTS-02-12 (atomic mark-used-before-send) and the append-only log (FR-DRAFTS-04-7) both need an explicit write discipline in the TP.

## Dependencies

| Package | Kind | Used by |
|---|---|---|
| `@modelcontextprotocol/sdk` ^1.32.2 | runtime | `server.ts` (Server, StdioServerTransport, request schemas, notifications). Needed. |
| `zod` ^4.6.7 | runtime | `server.ts:171` only, for the permission-request notification schema. Dies if C5 is removed, unless the new tools use it for input validation (they should: tool args are currently cast `as Record<string, any>`; validation at the trust boundary is missing). |
| `@changesets/cli` ^3.0.3 | dev | release flow (`bun changeset`, `version`, `release`). |
| `@types/bun` ^1.4.4 | dev | typecheck of `bun:test`, `import.meta.dirname`. |
| `typescript` ^7.0.2 | dev | `bun run typecheck`. |
| Bun built-ins | n/a | `bun:test`, `fetch`, `node:http`, `node:fs`, `node:crypto`. No SQLite used yet (`bun:sqlite` is available with no new dependency; relevant to the storage ADR). |

Hand-rolled instead of a library: dotenv loader (`config.ts`), CSV parser (`csv.ts`), Google JWT (`sheets.ts`). Fine at this size.

## Recommendation

| Module | Verdict | Reason |
|---|---|---|
| `server.ts` | Rewrite (keep skeleton) | Keep MCP wiring, stdio-safe logging, `/health`, `readBody`; replace tools, instructions, push path, and drop permission relay (C1-C7). 332 lines mix routes, tools and policy; split into tools, http and signals. |
| `config.ts` | Keep, extend | Works. Add settings that are owner data (periods, window, quiet hours) as persisted settings, not `.env`; keep `.env` for secrets only. |
| `types.ts` | Extend | `Provider` needs a fetch/catch-up method; `Inbound` needs type, readable, transcript, sent time, source, history flag; `Echo` becomes a stored message with source. |
| `conversations.ts` | Replace | Per-chat JSONL without ids, source or order cannot back Inbox, Intake dedup or the log. Pauses go away (C6). Replace with a message store keyed by (provider, provider id). |
| `providers/graph.ts` | Keep (sender part), trim | `splitText`, `verifyHmac` and type mapping are reusable; `markRead` and the Meta-shaped mapper only if Kapso's payload matches (check `kapso.md`). |
| `providers/kapso.ts` | Extend | Keep the signed webhook path for optional live delivery; add REST catch-up with paging and rate-limit handling. |
| `providers/meta.ts` | Delete | v1 accepts only Kapso and dev (FR-INTAKE-01-1). Its echo logic is a useful reference for Kapso `business_app`. |
| `providers/dev.ts` | Extend | Add missed-message, unreadable types, transcript, out-of-order, history flag, forged-delivery cases; mark data as dev. |
| `providers/index.ts` | Keep | Registry is fine; narrow to `kapso`, `dev`. |
| `store/csv.ts` | Keep (catalog), rewrite (orders) | Catalog aliases and parser are good. Order flattening cannot hold snapshots, history or message links. |
| `store/local.ts` | Rewrite | Append-only CSV cannot update, delete or keep history. |
| `store/sheets.ts` | Extend | JWT and API helper reusable; needs update, delete, history, and an unreachable-is-failure path. Untested today; add tests. |
| `store/index.ts` | Keep | Registry fine. |
| `operator/` | Rewrite allow-list, keep the lock-down | New tool names; keep the deny list (CLAUDE.md says do not loosen). `PROMPT.md` must say customer text is read only via labeled views. |
| `scripts/operator.sh` | Keep | Flags still right. |
| `scripts/start.sh` | Keep | tmux only; note it does not run on Windows. |
| `scripts/simulate.sh` | Keep, extend | Needs cases for the new dev events. |
| `test/e2e.test.ts` | Rewrite per slice | Current five tests assert the behavior the FRDs remove (reply sends at once, handoff pause, permission relay). Keep the harness (`start`, `sseCollector`, `post`, `call`) for ATDD; port the Meta test to nothing (C9) and the Kapso test to signature and catch-up. |
| `test/unit.test.ts` | Keep | CSV and `splitText` tests stay valid. |
| `business/`, `examples/` | Keep | Templates feed Knowledge FRD-01-7. |

## Checks

Run from the repo root. Result values are reported in the message to team-lead.
