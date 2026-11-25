# ADR-005: Local time through a calendar port over Intl, with a minute scan

## Status
Accepted (2026-11-24)

## Summary

A `LocalCalendar` outbound port (`systemZone`, `isValidZone`, `minuteOfDay`, `localParts`) with an adapter over `Intl.DateTimeFormat` (`hourCycle: "h23"`). The domain stores quiet periods as minutes of the local day and finds the end of a quiet stretch by stepping forward one minute at a time until no period covers the minute, at most 1440 steps. Checked in Bun 1.4.4 on Windows, from source and from a compiled binary: America/New_York quiet 22:00 to 07:00 ends at `2026-03-08T11:00Z` and `2026-11-01T12:00Z`; 1440 calls took 4 ms; an invalid zone throws `RangeError`.

## Context
Quiet periods are wall-clock hours in the owner's time zone and must follow daylight saving (FR-NOTIFY-02-2). Owners live in many zones. From TP-02 TD-2; cross-cutting TD-7.

## Decision
A `LocalCalendar` outbound port (`systemZone`, `isValidZone`, `minuteOfDay`, `localParts`) with an adapter over `Intl.DateTimeFormat` (`hourCycle: "h23"`). The domain stores quiet periods as minutes of the local day and finds the end of a quiet stretch by stepping forward one minute at a time until no period covers the minute, at most 1440 steps. Checked in Bun 1.4.4 on Windows, from source and from a compiled binary: America/New_York quiet 22:00 to 07:00 ends at `2026-03-08T11:00Z` and `2026-11-01T12:00Z`; 1440 calls took 4 ms; an invalid zone throws `RangeError`.

## Options considered
- The `Temporal` global of Bun 1.4.4. It works (a gap `01:30` moved to `02:30` gives `03:30-04:00`), but I could not check its TypeScript types in this repository's toolchain, and `Intl` is already verified by the cross-cutting TP. It stays one adapter away.
- `luxon`, `date-fns-tz` or `temporal-polyfill`. A dependency for two functions that `Intl` gives directly.

## Consequences
- Easier: no dependency; DST behavior is the runtime's; tests use fixed instants.
- Harder: the scan assumes whole-minute UTC offsets (true for all zones in use).
- Watch: a union that covers the whole day is refused at set time, so the scan always ends.
