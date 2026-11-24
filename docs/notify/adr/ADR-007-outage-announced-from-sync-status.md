# ADR-007: Provider outages are announced from Intake's sync status, once per streak

## Status
Accepted (2026-11-18)

## Context
When the provider cannot be reached for longer than one catch-up period, the owner gets one fixed notice, and one more when it recovers (FR-NOTIFY-03-8). From TP-03 TD-2.

## Decision
`Tick` reads `GetSyncStatus`. An outage is due when `status` is `failed`, the reason is one of `unreachable`, `timeout`, `credentials`, `quota`, `usage_limit`, `bad_response`, `tellOwner` is true, `failedSince` is set and `now - failedSince > catchUpMinutes`. Notify stores the announced `failedSince` in `notice_state.outage_announced_since`. It announces when the value differs, and sends one recovery notice when the status is no longer such a failure. The notice carries Intake's closed reason code, never provider text, and has one English default text per reason, so the text is right for a rejected key or a used-up quota too. A test assigns every Intake `SyncReason` to outage or not outage.

## Alternatives
- Subscribe to `CatchUpFinished` and count failures in Notify. It repeats Intake's streak and `tellOwner` logic and loses the counter at restart.

## Consequences
- Easier: restart-safe; no duplicate announcement.
- Harder: Notify reads one more set of Intake fields.
- Watch: a new Intake reason fails the assignment test until Notify decides.
