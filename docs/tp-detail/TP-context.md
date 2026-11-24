# TP: context

Part of [TP.md](../tp/TP.md). Moved verbatim from there; nothing changed.

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
