# ADR-015: The spreadsheet id comes from the terminal; a switch leaves a notice

## Status
Proposed

## Context
Orders may go to the owner's own spreadsheet (D7). The id is a destination for personal data. FR-ORDERS-03-2 and FR-ORDERS-03-5b. From Orders TP-03 TD-5.

## Decision
- `deputy config set orders-spreadsheet <id or URL>` stores the id in `~/.deputy/config.json`. Talking can only switch `orders_store` between `machine` and `spreadsheet`.
- A switch to `spreadsheet` runs a probe (token, access, layout, tab creation if empty) and is refused with a code if it fails, with the service-account email to share the sheet with.
- On every switch Deputy counts the orders in the place it leaves and stores it. `list_orders` returns `oldPlace {place, remaining}` until the owner switches back. Orders are never copied.

## Alternatives
- Everything by talking: injected text could redirect all new orders to an attacker's sheet.
- Everything in the terminal: the owner cannot say "use the machine for now" in conversation.

## Consequences
- Easier: the destination of order data is always an owner decision made in a place the agent cannot write.
- Harder: one terminal step; one more key for the sensitive list of cross-cutting TD-8 (flagged to the lead).
