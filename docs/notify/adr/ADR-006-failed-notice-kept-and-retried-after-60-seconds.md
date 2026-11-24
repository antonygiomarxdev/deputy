# ADR-006: A failed notice returns its batch to pending and is retried after 60 seconds

## Status
Proposed

## Summary

The in-flight batch goes back into the pending set with its original start time. The failure is recorded (`last_failed_at`, reason, count). `retryNotBefore = now + 60 seconds`. 60 seconds is the smallest batching period the owner can set, so a failure never costs more than the shortest healthy period, and it allows at most 60 attempts an hour. An exception from the adapter is treated as `write_error`.

## Context
A notice fails when there is no session or the write errors (FR-NOTIFY-03-6). The next notice must count those messages as new (FR-NOTIFY-03-7). From TP-03 TD-1.

## Decision
The in-flight batch goes back into the pending set with its original start time. The failure is recorded (`last_failed_at`, reason, count). `retryNotBefore = now + 60 seconds`. 60 seconds is the smallest batching period the owner can set, so a failure never costs more than the shortest healthy period, and it allows at most 60 attempts an hour. An exception from the adapter is treated as `write_error`.

## Options considered
- Retry on every 30 second tick. With no session this records about 120 failures an hour and reads Inbox each time.
- Exponential backoff up to the batching period. With a 24 hour period a reopened session could wait hours.

## Consequences
- Easier: no message count is lost; one rule for every kind of notice.
- Harder: `failed_since_delivery` counts attempts, not notices.
- Watch: outage and recovery notices stay due after a failure.
