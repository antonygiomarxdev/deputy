# SPEC-08-3: `deputy config set` writes the connection settings to `config.json`

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

`config set` for the keys that live in `~/.deputy/config.json`: `provider`, `receiving_mode`, `push`, `kapso-phone-number-id` and `orders-spreadsheet`. The command writes the file and exits. It takes no lease; the `LeaseSupervisor` re-reads the file. `catalog-store` is SPEC-08-6.

Last change: 2026-11-24, answers of the lead folded in; `catalog-store` moved to SPEC-08-6

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.
- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.

R1 is the first row above, R2 the second. The ADR has no row ids, so these labels are local to the spec.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/config/config-file.ts` | Change | `writeConfigKey`: sets one key and keeps the others |
| `src/adapters/cli/config.ts` | Create (made by SPEC-08-1; this spec changes it) | the five keys, next to the pending-change keys |
| `test/adapters/cli/config-file-keys.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/config/config-file.ts` `readConfigFile`: reads the object the writer changes, and throws `ConfigError` on a bad file
- `src/intake/adapters/config/file-connection-config.ts` `kapso_phone_number_id`: the key names the reader already uses (`provider`, `receiving_mode`, `kapso_phone_number_id`)
- `src/intake/application/resolve-provider-settings.ts` `receiving_mode`: what the reader accepts for `provider` and `receiving_mode`
- Precedent: SPEC-08-1-config-set-business-number.md, the command shape, the stored command, the messages and the exit codes

## Tests first
Written before the code, without it in view, on a temporary config folder. R2: (1) `provider kapso` writes `provider` and keeps every other key; (2) the same for `receiving_mode`, `kapso-phone-number-id` (key `kapso_phone_number_id`) and `orders-spreadsheet` (key `orders-spreadsheet`, as Orders TP-03 names it), and `push on` stores `true` and `push off` stores `false` under `push_on`; a `provider` or `receiving_mode` the reader rejects, or another `push` value, writes nothing and returns 1; (3) a missing file is created; (4) no pending-change row is written and no `OwnerLease` is imported. R1: (5) an unreadable file is left untouched, one line is printed and the code is 2; (6) a missing value prints one line and returns 1.

## Build
```ts
export async function writeConfigKey(dir: string, key: string, value: string | boolean): Promise<void>;
```
Key names: the reader's where they exist, `orders-spreadsheet` as Orders TP-03 and ADR-015 give it, otherwise snake_case of the ADR-008 name (`push_on`). Values are stored in the form `FileConnectionConfig` accepts: strings as typed. Invalid is what `ResolveProviderSettings` rejects: a `provider` other than `kapso` or `dev`, a `receiving_mode` other than `catch-up` or `live`; those print one line and return 1. No reader reads `push_on` or `orders-spreadsheet` yet: `push on` and `push off` store the JSON boolean `true` or `false` under `push_on`, any other `push` value is invalid, and `orders-spreadsheet` stores the string as typed under `orders-spreadsheet`. `runConfig` (SPEC-08-1) gains the five keys, each calling `writeConfigKey` with `d.configDir`, printing `deputy: <key> saved; the running Deputy re-reads config.json.` and returning 0.

## Done when
`bun test test/adapters/cli/config-file-keys.test.ts`

## Out of scope
Reducing a spreadsheet URL to its id: Orders TP-03 puts it in the Orders reader, so the command stores the value as typed.
Owner numbers and the business number (SPEC-08-1, SPEC-08-2); `catalog-store` (SPEC-08-6). Reading the file back is `readConfigFile`, built.

## Open questions
None.
