# SPEC-05-3: list the provider account's numbers and detect a refused key

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

After the key is stored, Deputy asks the provider for the numbers of the owner's account. A refused key becomes a plain-words error that keeps nothing as working.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-9 | IF | IF the provider does not accept the key, THEN Deputy shall say in plain words that the provider refused it, keep nothing as working, and offer the key page again. |
| FR-SETUP-05-10 | WHEN | WHEN the key is stored and accepted, Deputy shall list the numbers of the owner's provider account, let the owner pick the business number, and keep that number's provider id. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/setup/adapters/kapso/list-numbers.ts | Create | the call and the mapping to `{ id, display }` |
| test/setup/list-numbers.test.ts | Create | fake HTTP: success, refused key, unreachable |

## Reuses
- `src/intake/adapters/kapso/kapso-http.ts` `KapsoHttp`: the provider client, its pacing and its error mapping.
- `src/intake/adapters/kapso/kapso-provider.ts` `businessNumber`: the same phone-numbers path and response shape, read for one number.
- `src/intake/ports/provider.ts` `ProviderError`: the `credentials` kind that a refused key maps to.

## Tests first
FR-SETUP-05-9: when the provider answers that the key is refused, `listNumbers` throws `ProviderError` of kind `credentials`, and the caller's message says in plain words that the provider refused the key; nothing is stored as working. FR-SETUP-05-10: `listNumbers` reads every page up to `meta.total_pages` and returns each number as `{ id, display }`, where `id` is the Meta phone number id and `display` is `display_phone_number`, else `display_phone_number_normalized`, else `name`; one case has a null `display_phone_number`.

## Build
```ts
export interface ProviderNumber { readonly id: string; readonly display: string }
export function listNumbers(http: KapsoHttp, signal: AbortSignal): Promise<ProviderNumber[]>;
```
The call is `GET /platform/v1/whatsapp/phone_numbers` with the API key header, followed page by page (L11). The Meta phone number id is the value kept as `kapso_phone_number_id`.

## Done when
`bun test test/setup/list-numbers.test.ts`

## Out of scope
- The tool the agent calls and the owner's pick: SPEC-05-4.

## Open questions
None. The call is recorded as L11 (source: docs.kapso.ai, List phone numbers).
