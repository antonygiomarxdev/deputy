# ADR-004: Notify settings are a typed aggregate that validates itself

## Status
Accepted (2026-11-18)

## Context
The owner changes batching, reminder, quiet periods, time zone and on/off by talking (FR-NOTIFY-02-1, FR-NOTIFY-02-4, FR-NOTIFY-02-5, FR-NOTIFY-02-9). A bad value is refused and the old one kept. From TP-02 TD-1; cross-cutting TD-8 (settings routed by key to the owning slice).

## Decision
`NotifySettings` is a domain aggregate with value objects `BatchPeriod` (1 to 1440 minutes), `ReminderPeriod` (5 to 1440), `QuietSchedule` (at most 8 periods to bound the stored value, the union never the whole day) and a time zone checked through the `LocalCalendar` port. `SetNotifySettings` builds the value object, saves through `NotifySettingsRepository` and returns a refusal code with the range and the kept value on failure. `SetNotifySettings` also refuses owner words that equal a stored customer message, through the `CustomerTextCheck` port (Intake `IsCustomerText`), as Inbox ADR-009 does. The MCP adapter only parses the wire shape.

## Alternatives
- Generic key and value validation in the MCP adapter, with raw strings in the table. The FRD's tests would need a server, and a second inbound adapter would copy the rules.

## Consequences
- Easier: range and quiet-period rules run in unit tests with a fake clock.
- Harder: four small classes.
- Watch: the ranges come from FR-NOTIFY-02-4. The cap of 8 quiet periods only bounds a stored value.
