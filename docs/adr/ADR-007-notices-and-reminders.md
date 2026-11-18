# ADR-007: Counts-only notices from a scheduler in the owner process

## Status
Proposed

## Context
D5: notices carry counts only, are batched (default 10 minutes) and repeated as reminders (default 30 minutes). FR-NOTIFY-01-1 sends them to the agent session, not to WhatsApp. Push exists only where the agent supports it (principle 4). From TP TD-7.

## Decision
- A scheduler adapter in the owner process (ADR-002) only calls Notify's `Tick` use case on a timer. The use case, subscribed to Intake's `MessageStored` event, reads the ignore list and the waiting count from Inbox, and builds the notices.
- A notice is a fixed code with an English default text, filled with numbers (D20). No customer text, name or excerpt can enter it. Deputy ships no other language: the server instructions tell the agent to say notices, hold reasons, refusals and status reasons in the owner's language, and the result carries the code so the agent translates the meaning, not the English words. Tests check that every code has a default text.
- Settings (batch, reminder, quiet periods, time zone, on and off, reminders paused) live in the settings table and apply from the next period. The time zone defaults to the system zone, `Intl.DateTimeFormat().resolvedOptions().timeZone`, read once at first start; the owner can change it. Quiet periods are wall-clock hours in that zone, evaluated with `Intl.DateTimeFormat` for the zone at each tick, never as a fixed UTC offset. DST test (America/New_York, quiet 22:00 to 07:00, checked in Bun 1.4.4): 2026-03-08 is 01:59 local at 06:59Z and 03:01 at 07:01Z, and the period ends at 11:00Z (8 real hours from 22:00 the evening before); 2026-11-01 ends at 12:00Z (10 real hours) and both 01:30s (05:30Z and 06:30Z) are quiet.
- Delivery is through the Claude Code channel when `push_on` is set. Otherwise nothing is pushed and the `inbox` tool is the record.
- A notice written without error counts as delivered. No session or an error counts as failed, and its messages are counted as new in the next notice.
- If the provider is unreachable for more than one catch-up period, one fixed-wording outage notice is sent.

## Alternatives
- A long-poll tool the agent calls (`wait_for_messages`): works in any MCP agent, but holds the agent's turn and hits tool timeouts (Codex defaults to 60 seconds). A later option for agents without push.
- A message catalog per language inside Deputy: it needs a translator for every language of every owner and goes stale with each wording change; the agent already speaks the owner's language (D20).
- A fixed UTC offset for quiet periods: wrong twice a year in zones with DST, and wrong for an owner who travels.
- Notify the owner over WhatsApp (current `notify_owner`): contradicts D5 and FR-NOTIFY-01-1, adds a send path outside drafts, and uses message quota.

## Consequences
- Easier: no injection path through notices; reminders do not depend on the agent remembering.
- Harder: depends on a research-preview channel for any push at all.
- Watch: the channel contract; a push has no acknowledgement.
