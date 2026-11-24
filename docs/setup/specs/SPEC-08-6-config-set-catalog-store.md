# SPEC-08-6: `deputy config set catalog-store` writes a pending change

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

`deputy config set catalog-store sheet:<id>` writes one `pending_changes` row with key `catalog_store` and exits. It takes no lease. TD-8 in `docs/tp/TP.md` says Knowledge's `ApplyCatalogStoreChange` applies this row, clears the catalog mapping and logs the typed command; that use case is not built here.

Last change: 2026-11-24, split from SPEC-08-3 after the lead's answer on key names

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.
- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.

R1 is the first row above, R2 the second. The ADR has no row ids, so these labels are local to the spec.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/config.ts` | Create (made by SPEC-08-1; this spec changes it) | the `catalog-store` branch of `runConfig` |
| `test/adapters/cli/config-catalog-store.test.ts` | Create | the tests below |

## Reuses
- Precedent: SPEC-08-1-config-set-business-number.md, the row, the stored command, the messages and the exit codes

## Tests first
Written before the code, without it in view. R2: (1) `catalog-store sheet:abc123` adds one row with key `catalog_store`, the value as typed, the command and the time, prints one line and returns 0; (2) no `OwnerLease` is imported and `config.json` is not written. R1: (3) a missing value, or a value that is not `sheet:` followed by an id, writes nothing, prints one line and returns 1; (4) a storage error returns 2.

## Build
`runConfig` (SPEC-08-1) gains `["set","catalog-store",v]`. It writes the row like SPEC-08-1 with key `catalog_store` and prints `deputy: catalog-store saved; the running Deputy applies it on its next tick, or at the next start.`

## Done when
`bun test test/adapters/cli/config-catalog-store.test.ts`

## Out of scope
Applying the row (Knowledge's `ApplyCatalogStoreChange`, in the Knowledge slice). The other file keys (SPEC-08-3). Any value other than `sheet:<id>`: the Knowledge documents name no other, so none is accepted. The key `catalog_store` is the snake_case of the ADR-008 name; the ADR lists `catalog-store` under `config.json` and TD-8 says a pending row, and this spec follows TD-8.

## Open questions
None.
