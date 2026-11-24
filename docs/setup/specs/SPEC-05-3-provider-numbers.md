# SPEC-05-3: list the provider account's numbers and detect a refused key

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

After the key is stored, Deputy asks the provider for the numbers of the owner's account. A refused key becomes a plain-words error that keeps nothing as working.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-9 | IF | IF the provider does not accept the key, THEN Deputy shall say in plain words that the provider refused it, keep nothing as working, and offer the key page again. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/setup/adapters/kapso/list-numbers.ts | Create | the call and the mapping to `{ id, display }` |
| test/setup/list-numbers.test.ts | Create | fake HTTP: success, refused key, unreachable |

## Reuses
- `src/intake/adapters/kapso/kapso-http.ts` `KapsoHttp`: the provider client, its pacing and its error mapping.
- `src/intake/ports/provider.ts` `ProviderError`: the `credentials` kind that a refused key maps to.

## Tests first
FR-SETUP-05-9: when the provider answers that the key is refused, `listNumbers` throws `ProviderError` of kind `credentials`, and the caller's message says in plain words that the provider refused the key; nothing is stored as working.

## Build
```ts
export interface ProviderNumber { readonly id: string; readonly display: string }
export function listNumbers(http: KapsoHttp, signal: AbortSignal): Promise<ProviderNumber[]>;
```
The request path comes from one constant, `NUMBERS_PATH`, settled by Q-1.

## Done when
`bun test test/setup/list-numbers.test.ts`

## Out of scope
- The tool the agent calls and the owner's pick: SPEC-05-4.

## Open questions
Q-1 (Research): which provider call lists the WhatsApp numbers of an account, and its answer shape; read the provider's API docs and record it as a D-n before approval.
