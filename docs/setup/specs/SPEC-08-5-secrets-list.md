# SPEC-08-5: `deputy secrets list` shows where each secret is kept

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

`deputy secrets list` is read-only. For each secret it prints the name and where it is kept, and never a value. It takes no lease and changes nothing.

Last change: 2026-11-24, first draft from ADR-008

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/secrets.ts` | Create (made by SPEC-08-4; this spec changes it) | the `list` branch of `runSecrets` |
| `test/adapters/cli/secrets-list.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/secrets/secret-store.ts` `createSecretStore`: its `get` returns `where: "os_store" | "file"`, the answer `list` prints
- Precedent: SPEC-08-4-secrets-set.md, `runSecrets` and its fake store

## Tests first
The rows above carry no ids, so the tests cite none. Written before the code, without it in view, with a fake store and a temporary config folder: (1) a secret in the store lists as kept in the OS store; (2) a secret only in `secrets.env` lists as kept in the file; (3) the output holds no value, whatever the value; (4) nothing is written to the store or the file.

## Build
`runSecrets(["list"])` asks the store for each known name, prints one line per name with its place, and returns 0.

## Done when
`bun test test/adapters/cli/secrets-list.test.ts`

## Out of scope
`secrets set` (SPEC-08-4).

## Open questions
- Q-1 (Lead): the list of names to show. The ADR names two and a Google path; TD-8 adds "present or absent", which the quoted row does not say. Does an absent secret get a line?
- Q-2 (Lead): the line format, and the exit code when no secret is kept.
