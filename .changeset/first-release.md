---
"deputy": minor
---

First release. Deputy is a Claude Code channel that answers a WhatsApp number on your behalf, using your own Claude Code session.

- Providers: Meta Cloud API direct, Kapso, and a dev provider for local testing
- Catalog and orders in local CSV files or Google Sheets
- Tools: `reply`, `history`, `get_catalog`, `create_order`, `list_orders`, `handoff`, `resume`, `notify_owner`
- Owner role, permission relay to WhatsApp, and automatic pause when the owner replies from the app (Coexistence)
- Locked-down operator profile in `operator/`
- Runs on Bun
