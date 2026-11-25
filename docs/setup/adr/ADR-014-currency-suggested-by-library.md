# ADR-014: The currency is suggested from the country by a maintained package behind a port

## Status
Accepted (2026-11-25)

## Summary

A `CurrencySuggester` port with one adapter that uses `country-to-currency` 3.0.2 (MIT, last published 2026-11-10, no dependencies, 251 country codes; https://www.npmjs.com/package/country-to-currency).

## Context
D21: Setup suggests the currency from the owner's country and the owner confirms it; it is stored as Knowledge's `currency`. Deputy serves owners in many countries. Libraries stay behind ports (cross-cutting ADR-000). From Setup TP-04, TD-4.

## Decision
A `CurrencySuggester` port with one adapter that uses `country-to-currency` 3.0.2 (MIT, last published 2026-11-10, no dependencies, 251 country codes; https://www.npmjs.com/package/country-to-currency). Checked in Bun 1.4.4 on Windows from source and from a `bun build --compile` binary: `US` gave `USD`, `MX` gave `MXN`, `AR` gave `ARS`, `US` gave `USD`, `DE` gave `EUR`, an unknown code gave `undefined`. An unknown code returns `null` and the owner is asked to name the currency. The owner confirms or corrects the suggestion; the confirmed code is passed to Knowledge in the seed call.

## Options considered
- A hand-written table of about 250 entries: it goes stale as currencies change.
- No suggestion: contradicts D21, and a non-technical owner does not know their ISO 4217 code.

## Consequences
- Easier: one dependency inside one adapter; the domain stays free of packages.
- Harder: a country with more than one used currency gets one suggestion; the owner confirms.
- Watch: the package is third-party; replace the adapter if it is abandoned.
