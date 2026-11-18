# ADR-003: The maximum window is a per-provider constant behind a port

## Status
Proposed

## Context
FR-INBOX-01-7 caps N at what the provider holds. Research found no API field for Kapso's retention: Kapso keeps messages "indefinitely by default" and paid projects can shorten it (`docs/research/kapso.md`). The longest history the WhatsApp Business app hands to the Cloud API at onboarding is 180 days (Meta, Onboard WhatsApp Business app users). From TP-01 TD-3.

## Decision
- Port `ProviderHistoryLimit.maxWindowDays()`. Its adapter returns 180 for Kapso and for dev, and 180 for any unknown provider name.
- `InboxSettings.setWindow(requested, max)` keeps `min(requested, max)` and reports `clamped`.
- The rule changes nowhere else when a real retention field is found: only the adapter changes.

## Alternatives
- Cap by stored reach (`now - oldestStoredAt`): a business connected three days ago could not set 14 days in advance, and a failed catch-up could lower the cap.
- Ask the provider: no such field was found, so nothing can be called.

## Consequences
- Easier: the FRD example (provider holds 30 days, owner asks 90) is a test with a fake that returns 30.
- Harder: a Kapso project with shorter retention accepts N above what it holds. This is harmless, because no older message exists to count.
- Watch: if Kapso adds a retention field, replace the constant and keep the port.
