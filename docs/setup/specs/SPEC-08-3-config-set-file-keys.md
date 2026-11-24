# SPEC-08-3: `deputy config set` writes the connection settings to `config.json`

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

`config set` for the keys that live in `~/.deputy/config.json`: `provider`, `receiving_mode`, `push`, `kapso-phone-number-id`, `orders-spreadsheet` and `catalog-store`. The command writes the file and exits. It takes no lease; the `LeaseSupervisor` re-reads the file.

Last change: 2026-11-24, first draft from ADR-008

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.
- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/config/config-file.ts` | Change | `writeConfigKey`: sets one key and keeps the others |
| `src/adapters/cli/config.ts` | Create (made by SPEC-08-1; this spec changes it) | the six keys, next to the pending-change keys |
| `test/adapters/cli/config-file-keys.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/config/config-file.ts` `readConfigFile`: reads the object the writer changes, and throws `ConfigError` on a bad file
- Precedent: SPEC-08-1-config-set-business-number.md, the command shape and the typed command

## Tests first
The rows above carry no ids, so the tests cite none. Written before the code, without it in view, on a temporary config folder: (1) `config set provider kapso` writes `provider` and keeps every other key; (2) the same for each of the other five keys; (3) a missing file is created; (4) an unreadable file is left untouched and the command returns non-zero; (5) no pending-change row is written.

## Build
```ts
export async function writeConfigKey(dir: string, key: string, value: unknown): Promise<void>;
```
`runConfig` (SPEC-08-1) gains the six keys; each calls `writeConfigKey` and returns 0.

## Done when
`bun test test/adapters/cli/config-file-keys.test.ts`

## Out of scope
Owner numbers and the business number (SPEC-08-1, SPEC-08-2). Reading the file back is `readConfigFile`, built.

## Open questions
- Q-1 (Lead): the key names in `config.json`. Today it holds `provider`, `receiving_mode` and `kapso_phone_number_id`. The ADR names `push_on` for `push`, and gives no file key for `orders-spreadsheet` or `catalog-store`.
- Q-2 (Lead): the stored form of a value: `push on` as a boolean or the word; `catalog-store sheet:<id>` whole or split.
- Q-3 (Lead): whether the command refuses a value it cannot use (a provider other than `kapso` or `dev`), or stores what was typed.
- Q-4 (Lead): the questions of SPEC-08-1 about the stored command text, the messages and the exit codes apply here too.
