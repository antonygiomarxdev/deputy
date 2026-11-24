# SPEC-08-1: `deputy config set business-number` writes a pending change

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

The first command of the owner's command line: `deputy config set business-number "<number>"` writes one `pending_changes` row and exits. It never takes the lease and applies nothing. It unblocks a new owner who has no number in the provider.

Last change: 2026-11-24, first draft from ADR-008

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.
- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/config.ts` | Create | `runConfig`: parses `config set business-number` and writes the row |
| `src/main.ts` | Change | sends the command `config` to `runConfig`; `serve` stays as it is |
| `test/adapters/cli/config-business-number.test.ts` | Create | the tests below |

## Reuses
- `test/support/harness.ts` `insertPendingChange`: the same INSERT, written by the tests today
- `src/intake/adapters/sqlite/sqlite-pending-changes-reader.ts` `KEYS`: the keys the owner process reads; `business_number` is one
- `src/shared/sql-database.ts` `SqlExecutor`: the port the row is written through
- `src/adapters/clock/system-clock.ts` `SystemClock`: the time of the row

## Tests first
The rows above carry no ids, so the tests cite none (see Open questions). Written before the code, without it in view: (1) `config set business-number "+505 8888 1111"` adds one row with key `business_number`, that value, the typed command and the time, and returns 0; (2) the module imports no `OwnerLease`, so it calls no lease-guarded use case; (3) a key other than `business-number` writes no row here; (4) a missing value returns non-zero and writes nothing.

## Build
```ts
export async function runConfig(argv: string[], d: { ex: SqlExecutor; clock: Clock; out: (s: string) => void }): Promise<number>;
```
`runConfig(["set","business-number",v])` runs `INSERT INTO pending_changes (key, value, command, at) VALUES ("business_number", v, <typed command>, clock.now())` and returns 0.

## Done when
`bun test test/adapters/cli/config-business-number.test.ts`

## Out of scope
Owner numbers and `remove` (SPEC-08-2); the file keys (SPEC-08-3); secrets (SPEC-08-4, SPEC-08-5). Applying the row is Intake's `ApplyPendingChanges`, already built.

## Open questions
- Q-1 (Lead): how does the command open `deputy.db`: the way `serve` does (creates and migrates it), or refuse when it is absent? ADR-008 says only that the row is written without the lease.
- Q-2 (Owner: only the owner decides what the owner sees on the screen): `ApplyPendingChanges` refuses an unreadable number, but only in the owner process's log, which the owner never sees. May the command parse the number first and refuse it on screen, and may it print what it wrote?
- Q-3 (Lead): the ADR rows carry no ids, so tests cannot cite one. Which ids does the command line get, as FR rows in a TP table?
- Q-4 (Lead): the exact text stored in `command` (the arguments as typed, how quotes are kept), and the exit codes.
