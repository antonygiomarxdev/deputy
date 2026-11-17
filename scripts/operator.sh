#!/usr/bin/env bash
# Run the locked-down operator session in the foreground. scripts/start.sh runs this inside tmux.
# The flags keep the owner's own setup out of a session that reads untrusted customer text:
# only Deputy's MCP server (no claude.ai connectors, no Claude in Chrome), no built-in tools,
# no user-level settings, hooks or plugins, and permission prompts instead of auto mode.
set -euo pipefail
cd "$(dirname "$0")/../operator"
exec claude --dangerously-load-development-channels server:deputy \
  --strict-mcp-config --mcp-config .mcp.json \
  --setting-sources project --tools "" --no-chrome \
  --permission-mode manual \
  --append-system-prompt-file PROMPT.md
