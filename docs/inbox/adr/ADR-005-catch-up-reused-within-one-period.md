# ADR-005: The summary reuses a catch-up that is fresher than one period

## Status
Proposed

## Summary

`ReadInbox` reads Intake's sync status. In the owner process, with `refresh = "auto"`, a status of `complete` and `now - lastSuccessAt < catchUpMinutes * 60,000`, it reuses the data.

## Context
R-INBOX-10 and FR-INBOX-02-2: the summary asks Intake to catch up first, but reuses a successful catch-up from within one catch-up period (default 2 minutes) and runs a new one after that or when the owner says "check again". The free Kapso plan allows 100 requests per minute and sends share the budget (cross-cutting TD-5). From TP-02 TD-2.

## Decision
- `ReadInbox` reads Intake's sync status. In the owner process, with `refresh = "auto"`, a status of `complete` and `now - lastSuccessAt < catchUpMinutes * 60,000`, it reuses the data.
- Otherwise it calls Intake's `CatchUp({ trigger: "asked" })` and waits Intake's default 20 seconds. `refresh = "force"` always calls.
- A process that is not the owner never starts one and warns `not_refreshing`.
- The port `CatchUpRunner` is new in Inbox's outbound list (the cross-cutting list lacked it).

## Options considered
- Always catch up: each ask costs several provider requests and ten asks a minute eat the send budget.
- Never catch up: a list after two days closed is stale and the owner is not told.

## Consequences
- Easier: repeated asks are cheap; the header shows the age of the data.
- Harder: a message that arrived just after the last run waits up to one period.
- Watch: if Intake changes the catch-up default, Inbox follows `catchUpMinutes` from the status and needs no change.
