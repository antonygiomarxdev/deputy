# ADR-013: A small Sheets client over fetch and jose

## Status
Accepted (2026-11-24)

## Summary

Measured 2026-11-17, Bun 1.4.4, Windows 11, from source and from `bun build --compile`; the `jose`-only binary is 115.28 MB.

## Context
Orders needs five Sheets endpoints and the service-account sign-in that cross-cutting TD-12 already builds with `jose`. From Orders TP-03 TD-3.

## Decision
Measured 2026-11-17, Bun 1.4.4, Windows 11, from source and from `bun build --compile`; the `jose`-only binary is 115.28 MB.
- A client in the shared `src/adapters/google/` over `fetch`: JWT (RS256, scope `spreadsheets`, 1 hour), a token cached until 5 minutes before expiry, `spreadsheets.get`, `values:batchGet` (render option `UNFORMATTED_VALUE` or `FORMATTED_VALUE`), `spreadsheets.batchUpdate` (Orders) and `values:batchUpdate` (input option `USER_ENTERED`, Knowledge only). Orders never uses `USER_ENTERED`.
- Request timeout 8 seconds. Reads retry up to 3 attempts on 429, 500, 503 or a network error, waiting 1 then 2 seconds. Writes retry on 429 only, because 429 means not processed; a timeout or 5xx on a write ends as `outcome_unknown`.
- No cell values or tokens in logs.

## Options considered
- `@googleapis/sheets` 18.1.3: 45 installed packages and 14 MB against 1 package and 1 MB for `jose`. It compiles and runs under `bun build --compile` (+0.53 MB, 144 modules, reached Google's token endpoint). Rejected for the 45 packages of supply chain in a binary that holds the service-account key and every order, and a second token path next to `jose`.
- `google-spreadsheet` 5.3.0: 26 installed packages and 27 MB with `google-auth-library`. It compiles and runs (+1.11 MB, 520 modules). Rejected for the same supply-chain reason and a row API that does not fit one atomic write of a row plus history rows.

## Consequences
- Easier: one token path, atomic writes, few dependencies.
- Harder: Deputy owns the request building; one contract test against the fake guards it. It is shared with Knowledge.
