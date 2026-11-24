# SPEC-08-8: `deputy config set orders-spreadsheet` stores the sheet's id

Status: Draft
Rests on: ../../orders/tp/TP-03-storage-and-export.md

## Summary

`deputy config set orders-spreadsheet <id or URL>` reduces a URL to its id, checks that the id is 20 or more of `A-Z a-z 0-9 _ -`, and writes the id to `~/.deputy/config.json` under `orders-spreadsheet`. A value that is neither refuses with exit 1. It takes no lease.

Last change: 2026-11-24, first draft, split from SPEC-08-3 after the lead's answer on the URL

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-ORDERS-03-2 | Given the id configured, When the owner switches to `spreadsheet`, Then the probe runs, the tabs and headers exist, the next record lands in the sheet and the list shows it; given no id, Then `spreadsheet_not_configured` with the command | UC, AC |

R1 is the row above: it is where the configured id is used. The rule for what the command accepts is in the same TP, Option A of the spreadsheet-id decision (line 87): "an id is 20 or more of `A-Z a-z 0-9 _ -`; a URL is reduced to its id". That line is an Option, which a spec may not carry as a Row, so it is cited here.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/config.ts` | Create (made by SPEC-08-1; this spec changes it) | the `orders-spreadsheet` branch of `runConfig` |
| `src/adapters/config/config-file.ts` | Change | `writeConfigKey`, built by SPEC-08-3, receives the id |
| `test/adapters/cli/config-orders-spreadsheet.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/config/config-file.ts` `readConfigFile`: the test reads the file back with it
- Precedent: SPEC-08-3-config-set-file-keys.md, `writeConfigKey`, the saved line, the exit codes

## Tests first
FR-ORDERS-03-2, written before the code, without it in view, on a temporary config folder: (1) an id of 20 or more of `A-Z a-z 0-9 _ -` is written as typed under `orders-spreadsheet` and the code is 0; (2) a sheet link `https://docs.google.com/spreadsheets/d/<id>/edit#gid=0` writes the id only; (3) a value that is not a link and is shorter than 20 characters, or holds another character, writes nothing, prints one line and returns 1; (4) a link with no id in it is refused the same way; (5) no pending-change row is written and no `OwnerLease` is imported; (6) the other keys of the file are kept.

## Build
`runConfig` (SPEC-08-1) gains `["set","orders-spreadsheet",v]`. If `v` starts with `http`, the id is the path segment after `/spreadsheets/d/` (Google's documented link form `https://docs.google.com/spreadsheets/d/<id>/...`), up to the next `/`, `?` or `#`; otherwise it is `v`. The id must match `^[A-Za-z0-9_-]{20,}$`, else print `deputy: "<v>" is not a sheet id or link; paste the sheet's id (20 or more letters, digits, - or _) or its link.` and return 1. Then `writeConfigKey(d.configDir, "orders-spreadsheet", id)`, print `deputy: orders-spreadsheet <id> saved; the running Deputy re-reads config.json.` and return 0.

## Done when
`bun test test/adapters/cli/config-orders-spreadsheet.test.ts`

## Out of scope
Switching the orders store between `machine` and `spreadsheet` (a setting changed by talking, Orders). The probe of the sheet. The other file keys (SPEC-08-3).

## Open questions
None.
