# REQ-13: Observability and metrics at product level

Status: Open
Links: [Show version, database size, lease and retry time in status](https://github.com/antonygiomarxdev/deputy/issues/171), [Add an error log table, a recent_errors tool and a log port](https://github.com/antonygiomarxdev/deputy/issues/172), [Show a monthly message count against the plan](https://github.com/antonygiomarxdev/deputy/issues/173), [Notify the owner about failing credentials, quota and long outages](https://github.com/antonygiomarxdev/deputy/issues/174), [Add a metrics(period) tool with local aggregates](https://github.com/antonygiomarxdev/deputy/issues/175), [Build opt-in telemetry with a visible payload](https://github.com/antonygiomarxdev/deputy/issues/176), [Ask the owner before sending a redacted crash report](https://github.com/antonygiomarxdev/deputy/issues/177)

## Summary

The owner asks for observability and metrics at product level. Three layers, kept apart: the owner's health view, the owner's business numbers, and maintainer telemetry. The first two never leave the machine. Telemetry is decided: yes, not urgent, once people start using Deputy; opt-in, off by default, app facts only, to see which features are used and steer the product.

Last change: 2026-11-24, owner decided telemetry yes, not urgent

## Who asked and when
The owner, 2026-11-24, in a Claude Code session.

## What they said
> otro tema, es temas de observabilidad y metricas etc a nivel de producto, incluyelo tamb

> para mi que si deberia, no urge, pero si cuando se empiece a usar, mas que nada para ver que usan que no y ver la direccion del producto, no tanto para ver temas privados

> para mi que si deberia, no urge, pero si cuando se empiece a usar, mas que nada para ver que usan que no y ver la direccion del producto, no tanto para ver temas privados

## The problem behind it
The `status` tool shows only intake sync. Logs live on stderr and die with the session, and the agent cannot read recent errors. Nothing counts messages against the Kapso plan limit, and the owner has no numbers about their own business. The maintainers learn nothing about how Deputy runs in the field.

## Evidence
- Twenty-two plain-text `console.error` calls carry error names only, never customer text. The owner will not look at stderr.
- Kapso counts sent and received messages against the monthly plan. Deputy shows it only when catch-up stops with `usage_limit`.
- Next.js, Astro, Prisma and Homebrew collect anonymous usage and are opt-out; Prisma asks consent before sending error reports. Deputy holds customer phone numbers and chat text, so opt-in is the defensible default.
- Meta's terms (section 4.1(b)) bar sharing Platform Data with third parties, including anonymized or aggregated data. Telemetry may carry app facts only, not WhatsApp-derived counts.
- Not checked: a Kapso usage endpoint, provider terms on telemetry, crash-report SDK defaults.

## Decision
Open. Waits for the owner to accept. Telemetry: the owner said yes, not urgent (p3), opt-in only. Still open: whether download counts are enough until 100 users, the plan size for the quota meter, and a written read from Kapso and Meta on tool-call counts.
