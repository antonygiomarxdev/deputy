# SPEC-05-4: the tools that open the key page and pick the number

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Two agent tools: one opens the key page and tells the agent to send the owner there, one lists the account's numbers and keeps the owner's pick. The tools never return the key.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-5 | WHEN | WHEN the provider key is needed, the agent shall open the one-time key page and tell the owner to paste the key there and not in the conversation. |
| FR-SETUP-05-10 | WHEN | WHEN the key is stored and accepted, Deputy shall list the numbers of the owner's provider account, let the owner pick the business number, and keep that number's provider id. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/setup/adapters/mcp/setup-tools.ts | Create | `open_key_page`, `list_numbers`, `select_number` |
| test/setup/setup-tools.test.ts | Create | tool results and the saved id |

## Reuses
- `src/intake/adapters/mcp/intake-tools.ts` `intakeTools`: the shape of a tool and of its text result.
- Precedent: SPEC-05-2-key-page.md, the page this spec opens.

## Tests first
FR-SETUP-05-5: `open_key_page` returns text that tells the owner to paste the key on the page and not in the conversation, and it never contains the key. FR-SETUP-05-10: `list_numbers` returns the account's numbers; `select_number` with an id from that list keeps the id, and an id not in the list is refused.

## Build
```ts
export interface SetupToolDeps {
  openKeyPage(): Promise<{ url: string }>;
  listNumbers(): Promise<{ id: string; display: string }[]>;
  saveNumberId(id: string): Promise<void>;
}
export function setupTools(d: SetupToolDeps): ToolDefinition[];
```
`saveNumberId` is injected; SPEC-05-12 wires it to the config writer of SPEC-05-8.

## Done when
`bun test test/setup/setup-tools.test.ts`

## Out of scope
- The config writer: SPEC-05-8. Registering the tools and building their dependencies: SPEC-05-12. The page itself: SPEC-05-2. The provider call: SPEC-05-3. The skill text that calls these tools: SPEC-05-7.

## Open questions
None. The id is kept in the config file by the writer of SPEC-05-8 (answered by the lead on 2026-11-24).
