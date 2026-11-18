# ADR-012: Phone numbers are parsed to E.164 with libphonenumber-js and compared by a per-country line key

## Status
Accepted (2026-11-18)

## Context
FR-INTAKE-04-14: "+505 8888 0000", "505-88880000" and "50588880000" are one number, for owner numbers and senders. Deputy serves owners in many countries. Owners type numbers in local formats, with or without a country code or a national trunk prefix. A configured number that never matches makes the owner's own replies look like customer messages.

A second problem: the id WhatsApp reports is not always the number a person dials. Argentina: WhatsApp ids carry a `9` after `54` (`5491123456789`), the dialled number does not (`541123456789`). Mexico: ids carry a `1` after `52` (`5215512345678`), the dialled number does not. Brazil: the ninth digit may be present or missing in the id (`5511987654321` or `551187654321`). I checked with `libphonenumber-js` 1.13.16: `+5491123456789` and `+541123456789` both parse as valid AR numbers but are different strings; `+5215512345678` parses with `isValid() = false`, `+525512345678` as valid MX.

Sources, all third-party except one sentence:
- Wassenger, "How to normalize international phone numbers for WhatsApp" (AR: 9 after 54; MX: 1 after 52; BR: the ninth digit must not be added twice): https://wassenger.com/blog/how-to-normalize-international-phone-numbers-for-whatsapp
- Whapi.Cloud support, "specifics of sending messages to numbers of different countries" (AR 13 digits, MX 1 after 52): https://support.whapi.cloud/help-desk/faq/specifics-of-sending-messages-to-numbers-of-different-countries
- Green-API FAQ, which says the Mexican `1` is not needed for some numbers: https://green-api.com/en/docs/faq/features-of-sending-and-receiving-messages-from-different-countries/
- Chatwoot issue #13932, cited in the audit (not re-read here).
- Meta has one relevant sentence in the Cloud API phone-number reference: "For Brazil and Mexico, the extra added prefix of the phone number may be modified by the Cloud API" (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers). I found no Meta source for Argentina, and none that states the format of the sender id in an inbound webhook or a Kapso business-app echo. The rules below therefore rest on third-party sources plus that one sentence, and a launch gate checks them live.

## Decision
- The `PhoneNumber` value object in `src/shared` holds an E.164 string and computes `lineKey()` with plain code. It imports nothing.
- Parsing is an outbound port, `PhoneNumberParser.parse(text, defaultCountry?) -> PhoneNumber | { invalid: reason }`. Its adapter in `src/intake/adapters/` wraps `libphonenumber-js` (default `min` metadata). Only that adapter imports the library (ADR-000), so it can be replaced without touching the domain, and use cases are tested with an in-memory parser.
- A number typed without a country code is parsed with the owner's country (Setup asks for it, D21) as the default region. Senders arrive in international form and parse without a default. A number the library cannot parse as possible is refused with a message that asks for the country code. Setup and the command line show the E.164 form back before storing it.
- The business number is read from the provider when it offers it (the Kapso phone number record); otherwise it must be typed with `+` and the country code. It never decides the default country.
- The provider's id is stored as received (`provider_sender`, and the chat's `provider_id`, which is also the destination of a send). Nothing rewrites it.
- Matching uses `PhoneNumber.lineKey()`: the E.164 string with the digit that WhatsApp inserts removed, by country:
  - AR: a national number that starts with `9` loses it (`+5491123456789` and `+541123456789` give `+541123456789`).
  - MX: an 11-digit national number that starts with `1` loses it (`+5215512345678` and `+525512345678` give `+525512345678`).
  - BR: an 11-digit national number whose third digit is `9` loses that digit (`+5511987654321` and `+551187654321` give `+551187654321`). Brazilian mobile numbers have had nine digits since 2017 (Anatel), but Meta says the prefix may be modified, and the key makes both forms one line.
  - Every other country: the key is the E.164 string.
- `sameLine(a, b)` is equality of line keys. Owner numbers, the business number and the `SourceClassifier` compare senders to owner numbers with it. Chats are looked up by line key too, so an echo whose counterpart id differs from the customer's own id lands in one chat; the stored `provider_id` is the one first received.
- Group ids and other non-number chat keys never pass through `PhoneNumber`.
- `PhoneNumberParser` also answers `isCountry(code)` (for the `country` setting) and serves `DescribeNumber`, which Setup uses to show a typed number back as E.164 and to count the customer messages of that line before it becomes an owner number. Setup never parses.
- The rules are a table in the value object, one entry per country. A new country is a new entry and a test.
- Launch gate (live check, first on Kapso): send one message through Deputy to a number in AR, MX and BR where one is available, and record the sender and counterpart format in the echo and in the inbound message. If a format differs from this table, fix the table before launch.

## Alternatives
- A hand-written digits-only rule (strip non-digits, 9 to 15 digits). Rejected: it cannot add a missing country code or handle national prefixes. A local number is refused or stored wrong, and the owner's replies stop matching.
- Require a leading `+` and the country code. Rejected: it fails FR-INTAKE-04-14 ("505-88880000" must match) and puts formatting work on a non-technical owner.
- Compare E.164 strings only (the first version of this ADR). Rejected: for an Argentine or Mexican owner the id `5491123456789` and the typed `+54 11 2345 6789` never match, so every owner reply from the phone app is classed as `customer`, and Deputy would answer a chat the owner already answered.
- Rewrite the provider's id to the dialled form before storing. Rejected: a send to the rewritten id may fail (Argentina and Mexico need the inserted digit on some routes) and the original is evidence for the launch gate.
- Query the provider for the canonical id of each number. Rejected: one request per number against a 100-requests-per-minute limit, and Kapso documents no such call.

## Consequences
- Easier: local formats from any country work, owner replies from AR, MX and BR owners are recognised, and every stored number has one canonical form.
- Harder: one runtime dependency (MIT, 1.13.16, modified 2026-11-10; it runs under Bun and inside a `bun build --compile` binary, checked on Windows); a per-country table to maintain.
- Watch: the table rests on third-party sources until the launch gate runs. Other countries may insert digits too (none found in the sources); the table is the one place to add them.

## Tests
- `lineKey` and `sameLine` for AR, MX and BR, both forms of each, one case that must not match (`+5491123456789` and `+5491123456780`), and a country with no rule (NI `+50588880000`).
- An owner number typed as `+54 11 2345-6789` classifies a sender `5491123456789` as `owner_app`. The same for MX `+52 55 1234 5678` with sender `5215512345678`, and BR `+55 11 8765-4321` with sender `5511987654321`.
- A typed local number (`011 15 2345 6789`, region AR) stores `+5491123456789`; Setup shows it back.
- The provider's id is stored unchanged.
- Watch: the per-country rules (AR, MX, BR) are best effort from public sources. Owners in those countries confirm or correct them with a field report; each correction adds a test case for its country.
