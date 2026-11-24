# SPEC-08-5: `deputy secrets list` shows where each secret is kept

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

`deputy secrets list` is read-only. For every known secret name it prints the name and `OS store`, `file` or `not set`, and never a value. It takes no lease and changes nothing.

Last change: 2026-11-24, answers of the lead folded in, no open question left

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.

R1 is the row above. The ADR has no row ids, so the label is local to the spec.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/secrets.ts` | Create (made by SPEC-08-4; this spec changes it) | the `list` branch of `runSecrets` |
| `test/adapters/cli/secrets-list.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/secrets/secret-store.ts` `createSecretStore`: its `get` returns `where: "os_store" | "file"`, the answer `list` prints
- Precedent: SPEC-08-4-secrets-set.md, `runSecrets`, `SECRET_NAMES` and its fake store

## Tests first
Written before the code, without it in view, with a fake store and a temporary config folder. R1: (1) a secret in the store lists as `OS store`; (2) a secret only in `secrets.env` lists as `file`; (3) a name in neither lists as `not set`; (4) every name in `SECRET_NAMES` gets one line; (5) the output holds no value, whatever the value, and nothing is written to the store or the file; (6) the code is 0, also when nothing is set.

## Build
`runSecrets(["list"])` asks the store for each name in `SECRET_NAMES`, prints `<name>: OS store`, `<name>: file` or `<name>: not set` on one line each, and returns 0.

## Done when
`bun test test/adapters/cli/secrets-list.test.ts`

## Out of scope
`secrets set` (SPEC-08-4).

## Open questions
None.
