# SPEC-08-0: the command line writes one pending change and never takes the lease

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

The part every `deputy config` command that writes a `pending_changes` row shares: one function that inserts the row (key, value, typed command, time) through `SqlExecutor`, and one that builds the typed command text. It calls no lease-guarded use case. SPEC-08-1, SPEC-08-2 and SPEC-08-6 build on it.

Last change: 2026-11-24, first draft, to trace the ADR-008 command contract to a Row

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.

R1 is the row above. The ADR has no row ids, so the label is local to the spec.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/pending-change.ts` | Create | `writePendingChange` and `typedCommand` |
| `test/adapters/cli/pending-change.test.ts` | Create | the tests below |

## Reuses
- `test/support/harness.ts` `insertPendingChange`: the same INSERT, written by the tests today
- `src/shared/sql-database.ts` `SqlExecutor`: the port the row is written through
- `src/intake/adapters/sqlite/sqlite-pending-changes-reader.ts` `SqlitePendingChangesReader`: reads these rows back, which the owner process applies on its next tick

## Tests first
Written before the code, without it in view, on an in-memory database with the shared migration. R1: (1) `writePendingChange` adds exactly one row with the key, the value, the command and the time, and `applied_at` empty; (2) a second call adds a second row and changes the first none; (3) `typedCommand(["config","set","business-number","+505 8888 1111"])` is `deputy config set business-number +505 8888 1111`, the arguments joined by single spaces after `deputy`; (4) a throwing executor lets the error out, so the caller can return 2; (5) the module imports no `OwnerLease` and no use case, so the command line never takes the lease; (6) `SqlitePendingChangesReader` reads the row a `business_number` write made.

## Build
```ts
export interface PendingChange { key: string; value: string; command: string; at: number }
export async function writePendingChange(ex: SqlExecutor, row: PendingChange): Promise<void>;
export function typedCommand(argv: string[]): string;
```
`writePendingChange` runs `INSERT INTO pending_changes (key, value, command, at) VALUES (?, ?, ?, ?)`. `typedCommand` returns `["deputy", ...argv].join(" ")`.

## Done when
`bun test test/adapters/cli/pending-change.test.ts`

## Out of scope
Parsing, messages and exit codes (SPEC-08-1). Writing `config.json` or the secrets file (SPEC-08-3, SPEC-08-4). Applying the row is the owner process, already built.

## Open questions
None.
