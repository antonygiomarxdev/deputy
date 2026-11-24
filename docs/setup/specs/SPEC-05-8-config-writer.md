# SPEC-05-8: write one setting to the config file

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Add the writer for the config file next to its reader, so the chosen provider id is kept where the existing reader finds it. One key is set at a time and every other key is kept.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-10 | WHEN | WHEN the key is stored and accepted, Deputy shall list the numbers of the owner's provider account, let the owner pick the business number, and keep that number's provider id. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/adapters/config/config-file.ts | Change | add `writeConfigKey` next to `readConfigFile` |
| test/adapters/config-file-write.test.ts | Create | write, keep other keys, refuse a broken file |

## Reuses
- `src/adapters/config/config-file.ts` `readConfigFile`: the reader whose file and error type the writer shares.

## Tests first
FR-SETUP-05-10: after `writeConfigKey(dir, "kapso_phone_number_id", id)` the reader returns that id and every other key is unchanged; a file that is not a JSON object is refused with `ConfigError` and left as it was; a missing file is created.

## Build
```ts
export async function writeConfigKey(dir: string, key: string, value: string): Promise<void>;
```
It reads with `readConfigFile`, sets the key, and writes the whole object back to a temporary file in the same folder before renaming it over config.json, so a crash cannot leave half a file.

## Done when
`bun test test/adapters/config-file-write.test.ts`

## Out of scope
- The tool that calls it: SPEC-05-4. The `deputy config` command and the pending-change path: the `deputy config` specs.

## Open questions
None.
