# SPEC-08-1: `deputy config set business-number` writes a pending change

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

The first command of the owner's command line: `deputy config set business-number "<number>"` checks the number, writes one `pending_changes` row and exits. It never takes the lease and applies nothing. It unblocks a new owner who has no number in the provider.

Last change: 2026-11-24, answers of the lead folded in, no open question left

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
Quoted from: ../../intake/adr/ADR-012-phone-numbers-parsed-with-libphonenumber.md

- A number typed without a country code is parsed with the owner's country (Setup asks for it, D21) as the default region. Senders arrive in international form and parse without a default. A number the library cannot parse as possible is refused with a message that asks for the country code. Setup and the command line show the E.164 form back before storing it.
- The business number is read from the provider when it offers it (the Kapso phone number record); otherwise it must be typed with `+` and the country code. It never decides the default country.

R1 is the first row above, R2 the second. ADR-012 has no row ids, so these labels are local to the spec. The command contract (a `pending_changes` row, no lease) is ADR-008, the document this spec rests on.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/config.ts` | Create | `runConfig`: checks the number and writes the row |
| `src/main.ts` | Change | for `config`: reads the settings, opens the database, calls `runConfig`; `serve` stays as it is |
| `test/adapters/cli/config-business-number.test.ts` | Create | the tests below |

## Reuses
- Precedent: SPEC-08-0-pending-change-writer.md, `writePendingChange` and `typedCommand`, which this spec calls and does not rewrite
- `src/main/database.ts` `openDatabase`: the module `serve` uses; it creates and migrates `deputy.db`
- `src/main/settings.ts` `readSettings`: the data folder, as `serve` reads it
- `src/intake/adapters/phone/libphonenumber-parser.ts` `LibphonenumberParser`: the same check `ApplyPendingChanges` makes, with no default country
- `src/intake/adapters/sqlite/sqlite-pending-changes-reader.ts` `KEYS`: `business_number` is one of the keys it reads
- `src/adapters/clock/system-clock.ts` `SystemClock`: the time of the row

## Tests first
Written before the code, without it in view, in `test/adapters/cli/config-business-number.test.ts`. (1) `business-number "+505 8888 1111"` adds one row with key `business_number`, the value as typed, the command and the time, and returns 0; (2) the module imports no `OwnerLease`, so it calls no lease-guarded use case; (3) with no `deputy.db` the database is created first; (4) the command stored is `deputy config set business-number +505 8888 1111`, the arguments joined by single spaces (the shell removes the quotes); (5) a storage error returns 2; (6) another key writes no row here. R1: (7) the parsed E.164 form `+50588881111` is printed before the row is written, and again in the saved line. R2: (8) a number typed without `+` and the country code is refused even when a country is set, prints one line and returns 1; (9) an unreadable number or a missing value writes nothing and returns 1.

## Build
```ts
export async function runConfig(args: string[], d: { db: SqlExecutor; clock: Clock; parser: PhoneNumberParser; out: (s: string) => void }): Promise<number>;
```
`args` start after `config`. `parser.parse(value, null)` must be `ok`, else print `deputy: "<value>" is not a phone number; write it with + and the country code.` and return 1. Print `deputy: business-number <e164>` with the parsed form, then call `writePendingChange(d.db, { key: "business_number", value, command: typedCommand(["config", ...args]), at: d.clock.now() })` (SPEC-08-0), print `deputy: business-number <e164> saved; the running Deputy applies it on its next tick, or at the next start.` and return 0. A throw from the database prints one line and returns 2. When `openDatabase` reports `newer`, `main.ts` prints serve's message and returns 2.

## Done when
`bun test test/adapters/cli/config-business-number.test.ts`

## Out of scope
Owner numbers and `remove` (SPEC-08-2); the file keys (SPEC-08-3); secrets (SPEC-08-4, SPEC-08-5). The row writer and the typed command text (SPEC-08-0). Applying the row is Intake's `ApplyPendingChanges`, already built.

## Open questions
None.
