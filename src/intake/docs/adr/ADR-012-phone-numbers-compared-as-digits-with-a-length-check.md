# ADR-012: Phone numbers are compared as digits only, and a number that cannot carry a country code is refused

## Status
Proposed

## Context
FR-INTAKE-04-14: "+505 8888 0000", "505-88880000" and "50588880000" are one number, for owner numbers and senders. A configured number that never matches would make the owner's own replies look like customer messages. From the Intake TP-04, TD-2.

## Decision
The `PhoneNumber` value object (in `src/shared`) strips every non-digit and removes a leading `00`. It accepts 9 to 15 digits and refuses anything else with a message that asks for the country code. Equality is string equality of the digits. Group ids and other non-number chat keys are not phone numbers and never pass through it.

## Alternatives
- A phone library (E.164 parsing): checks the country code properly, but adds a dependency and a large data table for one comparison.
- Require a leading plus: rejects "505-88880000", which FR-INTAKE-04-14 says must match.

## Consequences
- Easier: no dependency; one function covers owner numbers and senders.
- Harder: a short local number such as "8888 0000" is refused instead of silently never matching.
- Watch: a 9-digit number with no country code still passes; Setup shows the normalized form back to the owner.
