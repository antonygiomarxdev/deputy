# ADR-012: Phone numbers are parsed to E.164 with libphonenumber-js

## Status
Proposed

## Context
FR-INTAKE-04-14: "+505 8888 0000", "505-88880000" and "50588880000" are one number, for owner numbers and senders. Deputy serves owners in many countries. Owners type their numbers in local formats, with or without a country code or a national trunk prefix. A configured number that never matches makes the owner's own replies look like customer messages. From the Intake TP-04, TD-2.

## Decision
- The `PhoneNumber` value object in `src/shared` wraps `libphonenumber-js` (default `min` metadata) and stores numbers in E.164.
- A number typed without a country code is parsed with the country of the connected business number as the default. Senders from the provider arrive in international form and parse without a default.
- A number the library cannot parse as possible is refused, with a message that asks for the country code. Setup and the command line show the E.164 form back to the owner before storing it.
- Equality is equality of the E.164 strings. Group ids and other non-number chat keys never pass through `PhoneNumber`.
- Only the value object imports the library, so the rest of the domain does not depend on it.

## Alternatives
- A hand-written digits-only rule (strip non-digits, 9 to 15 digits). Rejected: it cannot add a missing country code or handle national prefixes. A local number is then refused or stored wrong, and the owner's replies stop matching. It re-implements a solved problem.
- Require a leading `+` and the country code. Rejected: it fails FR-INTAKE-04-14 ("505-88880000" must match) and puts formatting work on a non-technical owner.

## Consequences
- Easier: local formats from any country work, and every stored number has one canonical form.
- Harder: one runtime dependency; its metadata must be kept current through normal dependency updates.
- Watch: the default country comes from the business number, so an owner who adds a number from another country must type its country code. Setup says so.
