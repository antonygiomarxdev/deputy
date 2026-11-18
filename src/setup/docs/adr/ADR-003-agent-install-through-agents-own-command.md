# ADR-003: Install into the agent with the agent's own add command

## Status
Proposed

## Context
Step 1 puts Deputy into the owner's agent in test mode (L1, FR-SETUP-01-11), for Claude Code, Codex, Cursor and Gemini CLI (cross-cutting TD-1). The commands were checked on 2026-11-17: `claude mcp add --transport stdio --scope user <name> -- <cmd>` (https://code.claude.com/docs/en/mcp), `codex mcp add <name> -- <cmd>` (https://learn.chatgpt.com/docs/extend/mcp?surface=cli), `gemini mcp add [-s user|project] <name> <cmd>` (https://geminicli.com/docs/tools/mcp-server/). Cursor has no command; it reads `~/.cursor/mcp.json` (https://cursor.com/docs/context/mcp). From Setup TP-01, TD-3.

## Decision
`deputy install --agent <name>` is an inbound command-line adapter. For Claude Code, Codex and Gemini CLI it prints the exact agent command, then runs it with user scope. For Cursor it merges `mcpServers.deputy = { type: "stdio", command: <absolute path of deputy>, args: ["serve"] }` into `~/.cursor/mcp.json` with plain JSON, and leaves the file untouched when it cannot parse it. The entry sets no `provider`, so Intake resolves to the dev provider. The command is printed first so the owner can run it by hand if the spawn fails.

## Alternatives
- Edit every agent's file: needs a TOML library for Codex, and a bad merge corrupts the owner's agent configuration; the file paths and formats change with agent releases.
- Print commands only: a non-technical owner pastes long commands wrongly, against the 30-minute target.

## Consequences
- Easier: the agent owns its format; Cursor needs no library.
- Harder: four paths to test; Windows `.cmd` shims for npm-installed agents are unverified.
- Watch: the add commands change with agent releases (one live check per agent before launch).
