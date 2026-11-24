# SPEC-08-2: `deputy config set owner-numbers` and `config remove owner-number` write pending changes

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

Two more commands, built like SPEC-08-1: `config set owner-numbers "<number>"` writes a `pending_changes` row with key `owner_numbers`, and `config remove owner-number "<number>"` writes one with key `owner_number_remove`. Each number is checked first. Neither takes the lease.

Last change: 2026-11-24, answers of the lead folded in; the apply change moved to SPEC-08-7

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
Quoted from: ../../intake/adr/ADR-012-phone-numbers-parsed-with-libphonenumber.md

- A number typed without a country code is parsed with the owner's country (Setup asks for it, D21) as the default region. Senders arrive in international form and parse without a default. A number the library cannot parse as possible is refused with a message that asks for the country code. Setup and the command line show the E.164 form back before storing it.

R1 is the row above. ADR-012 has no row ids, so the label is local to the spec. The command contract (a `pending_changes` row, no lease) is ADR-008, the document this spec rests on.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/config.ts` | Create (made by SPEC-08-1; this spec changes it) | the two commands, next to `business-number` |
| `src/main.ts` | Change | passes `getCountry` from `SqliteIntakeSettingsRepository` to `runConfig` |
| `test/adapters/cli/config-owner-numbers.test.ts` | Create | the tests below |

## Reuses
- Precedent: SPEC-08-1-config-set-business-number.md, the checks, the row, the stored command, the messages and the exit codes
- `src/intake/adapters/sqlite/sqlite-pending-changes-reader.ts` `KEYS`: `owner_numbers` and `owner_number_remove` are two of the keys it reads
- `src/intake/adapters/sqlite/sqlite-intake-settings-repository.ts` `getCountry`: the country `ApplyPendingChanges` already uses as the default region

## Tests first
Written before the code, without it in view. (1) `owner-numbers "+505 8888 0000"` adds one row with key `owner_numbers`, the value as typed and the command; (2) `remove owner-number "+505 8888 0000"` adds one row with key `owner_number_remove`; (3) neither imports `OwnerLease`; (4) a missing value writes nothing and returns non-zero; (5) a storage error returns 2; (6) the two forms leave the `business_number` row alone. R1: (7) with the country set to NI, `"8888 0000"` is stored as typed and shown as `+50588880000`; (8) with no country set it is refused with the needs-a-country-code line; (9) a number the parser refuses writes nothing, prints one line and returns 1; (10) the parsed E.164 form is printed before the row is written.

## Build
`runConfig` (SPEC-08-1) gains `["set","owner-numbers",v]` and `["remove","owner-number",v]`, and its deps gain `getCountry: () => Promise<string | null>`, built in `main.ts` from `SqliteIntakeSettingsRepository`. `parser.parse(v, await getCountry())` must be `ok`, as `ApplyPendingChanges` parses it (Intake ADR-012: a number typed without a country code uses the owner's country). On `needs_country_code` it prints `deputy: "<v>" needs a country code; write it with + and the country code.`, on `unparseable` `deputy: "<v>" is not a phone number.`, and returns 1. Before the row it prints `deputy: <key> <e164>` with the parsed form. Otherwise the row is written like SPEC-08-1 with that key, and the one-line message names the key.

## Done when
`bun test test/adapters/cli/config-owner-numbers.test.ts`

## Out of scope
The business number (SPEC-08-1). Today `ApplyPendingChanges` reads the value of `owner_numbers` as the whole list of extra numbers. TD-8 in `docs/tp/TP.md` says "an add through `set`, a removal through `remove`", so the apply step must add; SPEC-08-7 makes that change. That the business number cannot be removed this way is checked when the row is applied.

## Open questions
None.
