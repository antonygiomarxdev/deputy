---
"deputy": patch
---

Start the operator with `scripts/operator.sh`. It runs Claude Code with only Deputy's MCP server and none of the owner's own setup (claude.ai connectors, Claude in Chrome, built-in tools, user settings, hooks, plugins, auto mode). The operator instructions moved from `operator/CLAUDE.md`, which Claude Code never loaded, to `operator/PROMPT.md`. `scripts/simulate.sh` keeps accents and other non-ASCII text on Windows.
