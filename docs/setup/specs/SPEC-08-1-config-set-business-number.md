# SPEC-08-1: `deputy config set business-number` writes a pending change

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

The first command of the owner's command line: `deputy config set business-number "<number>"` checks the number, writes one `pending_changes` row and exits. It never takes the lease and applies nothing. It unblocks a new owner who has no number in the provider.

Last change: 2026-11-24, answers of the lead folded in, no open question left

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.
- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.

R1 is the first row above, R2 the second. The ADR has no row ids, so these labels are local to the spec.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/config.ts` | Create | `runConfig`: checks the number and writes the row |
| `src/main.ts` | Change | for `config`: reads the settings, opens the database, calls `runConfig`; `serve` stays as it is |
| `test/adapters/cli/config-business-number.test.ts` | Create | the tests below |

## Reuses
- `src/main/database.ts` `openDatabase`: the module `serve` uses; it creates and migrates `deputy.db`
- `src/main/settings.ts` `readSettings`: the data folder, as `serve` reads it
- `src/intake/adapters/phone/libphonenumber-parser.ts` `LibphonenumberParser`: the same check `ApplyPendingChanges` makes, with no default country
- `src/intake/adapters/sqlite/sqlite-pending-changes-reader.ts` `KEYS`: `business_number` is one of the keys it reads
- `src/adapters/clock/system-clock.ts` `SystemClock`: the time of the row

## Tests first
Written before the code, without it in view, in `test/adapters/cli/config-business-number.test.ts`. R2: (1) `business-number "+505 8888 1111"` adds one row with key `business_number`, the value as typed, the command and the time, prints one line and returns 0; (2) the module imports no `OwnerLease`; (3) with no `deputy.db` the database is created first. R1: (4) the command stored is `config set business-number +505 8888 1111`, the arguments joined by single spaces; (5) a number without `+` and country code, an unreadable number or a missing value writes nothing, prints one line saying what to type, and returns 1; (6) a storage error returns 2; (7) another key writes no row here.

## Build
```ts
export async function runConfig(args: string[], d: { db: SqlExecutor; clock: Clock; parser: PhoneNumberParser; out: (s: string) => void }): Promise<number>;
```
`args` start after `config`. `parser.parse(value, null)` must be `ok`, else print `deputy: "<value>" is not a phone number; write it with + and the country code.` and return 1. Then run `INSERT INTO pending_changes (key, value, command, at) VALUES ("business_number", value, ["config", ...args].join(" "), clock.now())`, print `deputy: business-number saved; the running Deputy applies it on its next tick, or at the next start.` and return 0. A throw from the database prints one line and returns 2. When `openDatabase` reports `newer`, `main.ts` prints serve's message and returns 2.

## Done when
`bun test test/adapters/cli/config-business-number.test.ts`

## Out of scope
Owner numbers and `remove` (SPEC-08-2); the file keys (SPEC-08-3); secrets (SPEC-08-4, SPEC-08-5). Applying the row is Intake's `ApplyPendingChanges`, already built.

## Open questions
None.
