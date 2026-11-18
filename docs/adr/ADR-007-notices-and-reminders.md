# ADR-007: Counts-only notices from a scheduler in the owner process

## Status
Proposed

## Context
D5: notices carry counts only, are batched (default 10 minutes) and repeated as reminders (default 30 minutes). FR-NOTIFY-01-1 sends them to the agent session, not to WhatsApp. Push exists only where the agent supports it (principle 4). From TP TD-7.

## Decision
- A scheduler adapter in the owner process (ADR-002) only calls Notify's `Tick` use case on a timer. The use case, subscribed to Intake's `MessageStored` event, reads the ignore list and the waiting count from Inbox, and builds the notices.
- Notice text is a fixed template filled with numbers. No customer text, name or excerpt can enter it.
- Settings (batch, reminder, quiet periods in local clock time, on and off, reminders paused) live in the settings table and apply from the next period.
- Delivery is through the Claude Code channel when `push_on` is set. Otherwise nothing is pushed and the `inbox` tool is the record.
- A notice written without error counts as delivered. No session or an error counts as failed, and its messages are counted as new in the next notice.
- If the provider is unreachable for more than one catch-up period, one fixed-wording outage notice is sent.

## Alternatives
- A long-poll tool the agent calls (`wait_for_messages`): works in any MCP agent, but holds the agent's turn and hits tool timeouts (Codex defaults to 60 seconds). A later option for agents without push.
- Notify the owner over WhatsApp (current `notify_owner`): contradicts D5 and FR-NOTIFY-01-1, adds a send path outside drafts, and uses message quota.

## Consequences
- Easier: no injection path through notices; reminders do not depend on the agent remembering.
- Harder: depends on a research-preview channel for any push at all.
- Watch: the channel contract; a push has no acknowledgement.
