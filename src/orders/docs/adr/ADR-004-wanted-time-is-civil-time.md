# ADR-004: The date and time wanted are civil date and time, with no zone

## Status
Proposed

## Context
Deputy serves owners in many countries and time zones. Orders are filtered by the date wanted (R-ORDERS-7). From Orders TP-01 TD-4.

## Decision
- `wantedDate` is `YYYY-MM-DD` and `wantedTime` is optional `HH:MM`, both as the business sees them. Deputy checks only that the date is a real calendar date (month lengths, leap years), in code with no library.
- The creation time is an instant in epoch milliseconds.

## Alternatives
- An instant plus the owner's zone: every filter needs the zone from Notify's setting, and a DST change moves a stored 10:00 pickup by an hour.

## Consequences
- Easier: the date filter is a text comparison and is correct in every zone.
- Harder: Deputy cannot compute "in three hours"; nothing in the FRDs needs it.
