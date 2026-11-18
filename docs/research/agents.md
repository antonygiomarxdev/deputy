# Research: agent clients and MCP integration

Scope: what Deputy's core can rely on across MCP clients. Checked 2026-11-17. Only pages that were opened are cited. Where a page did not state something, the answer says "not stated" and is not a claim that the feature is absent.

## Q1. Claude Code: pushing into a session

- A server pushes today by declaring `capabilities.experimental['claude/channel']` and emitting `notifications/claude/channel` with `content` and optional `meta` (keys: letters, digits, underscores only). Claude sees it as `<channel source="..." ...>`. This is what `src/server.ts` already does.
- Channels are a research preview. A server in `.mcp.json` is not enough: the user must opt in per session with `--channels`. Custom servers are not on the allowlist, so they need `--dangerously-load-development-channels server:<name>` (or `plugin:<name>@<marketplace>`). That flag is interactive only: with `-p` or the Agent SDK it is ignored. Neither flag shows in `claude --help`.
- No supported route without the development flag exists today for a custom server. The only other route is the Anthropic allowlist (claude-plugins-official), or, on Team/Enterprise, an admin's `allowedChannelPlugins`. Team/Enterprise also need `channelsEnabled: true`. Not available on Amazon Bedrock, Google Cloud's Agent Platform, or Microsoft Foundry.
- If a server is not registered as a channel, events are dropped silently. Its tools and `instructions` still work (the doc says that "the MCP server still connects and its tools work, but channel messages won't arrive").
- Other surfaces, all standard MCP: `instructions` (delivered as context when the server connects), tools, and `list_changed` refresh of tools, prompts and resources. MCP prompts are invocable as `/mcp__<server>__<prompt>`. Extra: permission relay via `claude/channel/permission` (v2.1.234+ sends requests only to servers registered as channels). Risk: a server that negotiates protocol revision 2026-07-28 is not registered as a channel on the v2 runtime; `MCP_PROTOCOL_NEGOTIATION=legacy` keeps the earlier handshake.
- Polling alternative inside Claude Code: `/loop` and `CronCreate` (session-scoped, 1 minute minimum, 7-day expiry, only fire while the session is idle, no catch-up).

Source: https://code.claude.com/docs/en/channels-reference
Source: https://code.claude.com/docs/en/channels
Source: https://code.claude.com/docs/en/mcp
Source: https://code.claude.com/docs/en/scheduled-tasks

## Q2. Other clients

- Codex CLI: stdio servers via `[mcp_servers.<name>]` in `~/.codex/config.toml` (`command`, `args`, `env`, `cwd`); also streamable HTTP. It reads the server `instructions` field and uses it as server-wide guidance; keep the first 512 characters self-contained. `startup_timeout_sec` default 10, `tool_timeout_sec` default 60. Notifications, resources and prompts: not stated on the page.
- Cursor: stdio supported (Cursor runs the command). Supports tools, prompts, resources, roots, elicitation. Instructions and `list_changed`: not stated.
- Gemini CLI: stdio via `mcpServers` in `settings.json`. Server instructions are supported ("appended to the system instructions"). Prompts become slash commands; resources are supported and referenceable in chat. Notifications: not stated. Request timeout default 10 minutes. The page notes Gemini CLI was replaced by Antigravity CLI on 2026-06-18, so it may be stale.
- VS Code (Copilot agent mode): stdio supported ("Command (stdio)"). Tools, elicitation and MCP Apps are described. Resources, prompts, server instructions and `list_changed`: not stated on the page. Stopping a server ends only its current run; a later request can start it again.
- Push: none of these pages describe a push-into-session equivalent to channels. Not stated is not proof of absence, but nothing here can be relied on.
- The MCP clients page I opened (modelcontextprotocol.io/clients) is only an intro with no feature matrix, so it is not used for support claims.

Source: https://learn.chatgpt.com/docs/extend/mcp?surface=cli
Source: https://cursor.com/docs/context/mcp
Source: https://geminicli.com/docs/tools/mcp-server/
Source: https://code.visualstudio.com/docs/copilot/customization/mcp-servers

## Q3. Lifetime, timers, two instances

- The stdio transport: the client launches the server as a subprocess, and closes stdin and terminates it at the end. Claude Code's shutdown is SIGINT, then SIGTERM after 100 ms, then SIGKILL after 400 ms (macOS/Linux); on Windows it closes stdin, then ends the process tree after 300 ms. So the process lives exactly as long as the client session, and cleanup must be fast and idempotent.
- Nothing in the spec stops the server process from running `setInterval` timers and a `node:http` listener next to the stdio transport. The Claude Code channel example does exactly this (stdio plus `Bun.serve` in one process, and the doc says the listener "runs in the same process"). Claude Code's own stdio idle timeout is 30 minutes (`CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`); that doc passage is about tool calls, so I could not confirm it applies to an idle server with only a timer running. Treat that as unverified.
- Two sessions means two processes. Each client spawns its own server (stdio is one client per process). No source documents this case; the following is reasoning from the code and the OS, not a citation. The second `listen` on `DEPUTY_PORT` (default 8788, `src/config.ts:28`) fails with EADDRINUSE. Both processes would also read and write the same `data/` (`state.json`, `conversations/*.jsonl`, CSV store), and both would poll the provider and send duplicate notices.
- Recommendation (design, untested): one owner per data folder, using an exclusive lock file `data/.lock` created with `wx` (O_EXCL) that holds the pid and start time. Winner: runs the poller, the listener, the notices. Loser (lock held by a live pid): still starts as an MCP server so its tools work, but runs read-only against the same files and runs no timers and no listener; it says so in `instructions` ("another Deputy session owns this data"). Stale lock (pid dead): take over. Remove the lock on SIGINT/SIGTERM/stdin close. Also bind the port only after winning the lock, so a port clash never decides ownership. Appends to JSONL are safe enough for a loser; writes to `state.json` stay owner-only.

Source: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
Source: https://code.claude.com/docs/en/mcp
Source: https://code.claude.com/docs/en/channels-reference

## Q4. What the core relies on

- Core, works in every client above: tools only, plus a plain-text `instructions` string. Tools are the one thing every opened page confirms (Codex, Cursor, VS Code, Gemini, Claude Code). Instructions are confirmed for Codex, Gemini CLI and Claude Code, not stated for Cursor or VS Code, so the key rules must also live in the tool descriptions and in an owner-readable setup file (for example `operator/PROMPT.md`), not only in `instructions`.
- Design consequence: catch-up (D12) is a tool the agent calls ("check new messages") plus the server's own timer that updates what that tool returns. The agent decides when to call it, so it needs no push. Batched notices (D5) go to the owner's WhatsApp, not into the agent session, so they do not depend on agent push either.
- Keep out of the core: resources and prompts (Cursor and Gemini confirm them; Codex and VS Code pages do not say), `list_changed` (only Claude Code confirmed), elicitation, sampling.
- Claude-only extra: `claude/channel` push (live delivery, the "advanced setting" in D12) and `claude/channel/permission` relay. Both are opt-in, research-preview, and need `--dangerously-load-development-channels`, so setup must work and be useful with them off. Gate them behind a config flag and keep the tools path identical.
- Risk to track: the channel contract may change ("flag syntax and protocol contract may change"), and the 2026-07-28 revision issue on the v2 runtime.

Source: https://code.claude.com/docs/en/channels
Source: https://learn.chatgpt.com/docs/extend/mcp?surface=cli
Source: https://geminicli.com/docs/tools/mcp-server/
