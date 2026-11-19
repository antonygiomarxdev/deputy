#!/usr/bin/env bash
# Simulate a customer with the dev provider (Deputy running with no provider set, or provider "dev").
# Usage: scripts/simulate.sh 15557654321 "hi, how much is it?"
# The message is held at the dev provider, signed with the dev secret and delivered like a live message.
# Read it from the agent with get_chat, or ask for check_messages to see it found by catch-up.
set -euo pipefail
FROM="${1:-15557654321}"; TEXT="${2:-Hi, what do you sell?}"
BODY="$(bun -e 'console.log(JSON.stringify({ chat: process.argv[1], from: process.argv[1], text: process.argv[2] }))' "$FROM" "$TEXT")"
curl -s -X POST "http://127.0.0.1:${DEPUTY_PORT:-8788}/dev/deliver" -H 'content-type: application/json' -d "$BODY"
echo
