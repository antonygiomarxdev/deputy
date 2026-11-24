# SPEC-08-2: `deputy config set owner-numbers` and `config remove owner-number` write pending changes

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

Two more commands, built like SPEC-08-1: `config set owner-numbers "<number>"` writes a `pending_changes` row with key `owner_numbers`, and `config remove owner-number "<number>"` writes one with key `owner_number_remove`. Each number is checked first. Neither takes the lease.

Last change: 2026-11-24, answers of the lead folded in; the apply change moved to SPEC-08-7

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.
- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.

R1 is the first row above, R2 the second. The ADR has no row ids, so these labels are local to the spec.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/config.ts` | Create (made by SPEC-08-1; this spec changes it) | the two commands, next to `business-number` |
| `test/adapters/cli/config-owner-numbers.test.ts` | Create | the tests below |

## Reuses
- Precedent: SPEC-08-1-config-set-business-number.md, the checks, the row, the stored command, the messages and the exit codes
- `src/intake/adapters/sqlite/sqlite-pending-changes-reader.ts` `KEYS`: `owner_numbers` and `owner_number_remove` are two of the keys it reads

## Tests first
Written before the code, without it in view. R2: (1) `owner-numbers "+505 8888 0000"` adds one row with key `owner_numbers`, the value as typed and the command; (2) `remove owner-number "+505 8888 0000"` adds one row with key `owner_number_remove`; (3) neither imports `OwnerLease`. R1: (4) a number without a leading `+`, a number the parser refuses, or a missing value, writes nothing, prints one line and returns 1; (5) a storage error returns 2; (6) the two forms leave the `business_number` row alone.

## Build
`runConfig` (SPEC-08-1) gains `["set","owner-numbers",v]` and `["remove","owner-number",v]`. `v` must start with `+` and `parser.parse(v, null)` must be `ok`, with no country setting; else it prints `deputy: "<v>" is not a phone number; write it with + and the country code.` and returns 1. Otherwise the row is written like SPEC-08-1 with that key, and the one-line message names the key.

## Done when
`bun test test/adapters/cli/config-owner-numbers.test.ts`

## Out of scope
The business number (SPEC-08-1). Today `ApplyPendingChanges` reads the value of `owner_numbers` as the whole list of extra numbers. TD-8 in `docs/tp/TP.md` says "an add through `set`, a removal through `remove`", so the apply step must add; SPEC-08-7 makes that change. That the business number cannot be removed this way is checked when the row is applied.

## Open questions
None.
