#!/usr/bin/env bash
# Simulate a customer with the dev provider.  Usage: scripts/simulate.sh 15557654321 "hi, how much is it?"
# Watch Deputy's replies in another terminal:  curl -N localhost:8788/dev/events
set -euo pipefail
FROM="${1:-15557654321}"; TEXT="${2:-Hi, what do you sell?}"
curl -s -X POST "localhost:${DEPUTY_PORT:-8788}/webhook" -H 'content-type: application/json' \
  -d "$(node -e 'console.log(JSON.stringify({from:process.argv[1],name:"Test customer",text:process.argv[2]}))' "$FROM" "$TEXT")"
echo
