#!/usr/bin/env bash
# Start the operator session inside tmux (Raspberry Pi or any always-on box).
# First time: `tmux attach -t deputy` and confirm Claude Code's prompts.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || bun install --frozen-lockfile
tmux has-session -t deputy 2>/dev/null && { echo "Already running: tmux attach -t deputy"; exit 0; }
tmux new-session -d -s deputy "$PWD/scripts/operator.sh"
echo "Started. Attach with: tmux attach -t deputy  (detach without stopping it: Ctrl-b d)"
