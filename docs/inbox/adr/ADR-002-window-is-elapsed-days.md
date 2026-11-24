# ADR-002: The pending window is N elapsed days of 24 hours

## Status
Accepted (2026-11-18)

## Context
FR-INBOX-01-6 says the window is "the last N days, counted back from now". Deputy serves owners in many countries and time zones, so the rule must not depend on one. From TP-01 TD-2.

## Decision
`windowStart = now - N * 86_400_000` ms. A customer message is inside the window when `sentAt >= windowStart`. The boundary is inclusive. No time zone is read.

## Alternatives
- N calendar days in the owner's time zone: needs Notify's `time_zone` setting and DST rules, and the window would be 23 to 25 hours long on two days a year; "counted back from now" does not say calendar days.
- N days from the start of today in UTC: for an owner at UTC-3 the day changes at 21:00 local, so the boundary moves by up to a day.

## Consequences
- Easier: a pure function of `now` and N, tested with a fake clock and no time zone.
- Harder: on a DST change day the window is the same 24-hour count, not the same wall-clock time; the difference is one hour once or twice a year.
- Watch: the summary shows `windowDays` so the owner can see the rule in force.
