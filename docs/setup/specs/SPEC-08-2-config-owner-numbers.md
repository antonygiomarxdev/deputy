# SPEC-08-2: `deputy config set owner-numbers` and `config remove owner-number` write pending changes

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

Two more commands, built like SPEC-08-1: `config set owner-numbers "<numbers>"` writes a `pending_changes` row with key `owner_numbers`, and `config remove owner-number "<number>"` writes one with key `owner_number_remove`. Neither takes the lease. Intake's `ApplyPendingChanges` applies and logs them.

Last change: 2026-11-24, first draft from ADR-008

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.
- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/config.ts` | Create (made by SPEC-08-1; this spec changes it) | the two commands, next to `business-number` |
| `test/adapters/cli/config-owner-numbers.test.ts` | Create | the tests below |

## Reuses
- Precedent: SPEC-08-1-config-set-business-number.md, the command, the row and the typed command it stores
- `src/intake/adapters/sqlite/sqlite-pending-changes-reader.ts` `KEYS`: `owner_numbers` and `owner_number_remove` are two of the keys it reads

## Tests first
The rows above carry no ids, so the tests cite none. Written before the code, without it in view: (1) `config set owner-numbers "+505 8888 0000"` adds one row with key `owner_numbers`, that value and the typed command; (2) `config remove owner-number "+505 8888 0000"` adds one row with key `owner_number_remove`; (3) neither imports `OwnerLease`; (4) a missing value writes nothing and returns non-zero.

## Build
`runConfig` (SPEC-08-1) gains two branches: `["set","owner-numbers",v]` writes key `owner_numbers`; `["remove","owner-number",v]` writes key `owner_number_remove`. Both store `v` as typed and return 0.

## Done when
`bun test test/adapters/cli/config-owner-numbers.test.ts`

## Out of scope
The business number (SPEC-08-1). That the business number cannot be removed this way is checked when the row is applied, by `ApplyPendingChanges`; this command does not check it.

## Open questions
- Q-1 (Owner: only the owner knows what a second command should do): `ApplyPendingChanges` reads the value of `owner_numbers` as the whole list of extra numbers and removes extras that are not in it. The design example sets one number. Should `set owner-numbers` replace the list, or add to it?
- Q-2 (Lead): the value of `owner_numbers` is a comma list in the code and a single number in the ADR example. Which form does the owner type for several numbers?
- Q-3 (Lead): the questions of SPEC-08-1 about the database, the stored command text and the exit codes apply here too.
