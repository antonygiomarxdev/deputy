# SPEC-05-12: wire the setup tools into the server

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Build the dependencies of the setup tools in one composition file and register the tools in the server: the key page with the secret store, the provider's number listing, and the writer that saves the number, the provider and the receiving mode.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-5 | WHEN | WHEN the provider key is needed, the agent shall open the one-time key page and tell the owner to paste the key there and not in the conversation. |
| FR-SETUP-05-10 | WHEN | WHEN the key is stored and accepted, Deputy shall list the numbers of the owner's provider account, let the owner pick the business number, and keep that number's provider id. |
| FR-SETUP-05-33 | WHEN | WHEN the owner has picked the business number, Deputy shall write the provider setting and the receiving mode (periodic checking) into the configuration next to the number's provider id. (Proposed, lead decision.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/main/setup.ts | Create | `setupWiring`: key page, number listing, config writer |
| src/main/tools.ts | Change | add `setupTools` to the tool list |
| test/main/setup-wiring.test.ts | Create | fake provider and a temporary config folder |

## Reuses
- `src/main/connection.ts` `connectionConfig`: how the secret store and the config folder are built from the settings.
- `src/main/tools.ts` `mcpServer`: where the tool lists are joined.
- Precedent: SPEC-05-4-setup-tools.md, the tools this spec registers.

## Tests first
FR-SETUP-05-5 and FR-SETUP-05-10, the boot case: the server built by `mcpServer` with the wiring lists `open_key_page`, `list_numbers` and `select_number`, and a call to `open_key_page` returns the loopback url without any key. FR-SETUP-05-33: after `select_number` with a listed id, config.json holds `provider` "kapso", `receiving_mode` "catch-up" and `kapso_phone_number_id` with that id, and every other key is unchanged.

## Build
```ts
export function setupWiring(d: {
  configDir: string;
  secretService: string | null;
  kapso: () => Promise<KapsoHttp>;
}): SetupToolDeps;
```
`kapso` builds the provider client after the key is stored. `saveNumberId` calls `writeConfigKey` three times, for the number's id, the provider and the receiving mode. `mcpServer` adds `...setupTools(d.setup)` to its tool list.

## Done when
`bun test test/main/setup-wiring.test.ts`

## Out of scope
- The tools: SPEC-05-4. The key page: SPEC-05-2. The writer: SPEC-05-8. Telling the owner to reopen the session: SPEC-05-5.

## Open questions
None.
