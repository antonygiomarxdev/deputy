# ADR-008: Failed notices are shown in the status tool only

## Status
Accepted (2026-11-24)

## Summary

A pure `NotifyStatus` use case returns push mode, notices on or off, reminders paused, last delivered time, last failure time and reason (`no_session` or `write_error`), and the attempts since the last delivery. The existing `status` tool shows it with Intake's sync status. No new tool.

## Context
FR-NOTIFY-03-6 says the failure is recorded where the owner can see it. FRD-03 open question 2 asks where. From TP-03 TD-3.

## Decision
A pure `NotifyStatus` use case returns push mode, notices on or off, reminders paused, last delivered time, last failure time and reason (`no_session` or `write_error`), and the attempts since the last delivery. The existing `status` tool shows it with Intake's sync status. No new tool.

## Options considered
- Also a line in the `inbox` header. Inbox would depend on Notify, so the pull path would depend on the push extra (principle 4, R-NOTIFY-10), and D14 allows a cross-slice call only through a port the consumer defines.

## Consequences
- Easier: Inbox stays independent of Notify.
- Harder: the owner sees a failure only by asking.
- Watch: if the product wants the line in the inbox, it needs a new decision.
