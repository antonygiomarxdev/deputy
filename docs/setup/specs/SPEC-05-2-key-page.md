# SPEC-05-2: the one-time key page and the secret store write

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Deputy serves a one-time page on this computer. The owner pastes the provider key there and Deputy stores it in the secret store, with the owner-only file as the fallback. The agent is told only "stored".

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-6 | WHILE | WHILE the key page is open, it shall accept only a request from this computer that carries its one-time token, and it shall close after one successful submit or when the session ends. |
| FR-SETUP-05-7 | WHEN | WHEN the owner submits the key, Deputy shall store it in the secret store and tell the agent only that it is stored, never the value. |
| FR-SETUP-05-8 | IF | IF the secret store is unavailable, THEN Deputy shall say so, use the owner-only file the secrets decision names (ADR-008), and tell the owner where the key is kept and why. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/setup/adapters/http/key-page.ts | Create | the page, its token and its closing rules |
| src/adapters/secrets/secret-store.ts | Change | add `set(name, value)` with the file fallback |
| test/setup/key-page.test.ts | Create | token, host, close and fallback tests |

## Reuses
- `src/adapters/secrets/secret-store.ts` `createSecretStore`: the read side and the file format this spec writes to.
- `src/intake/adapters/http/listener.ts` `LiveListener`: a loopback server that refuses a request from outside, the pattern the page follows.

## Tests first
FR-SETUP-05-6: a request without the token, with a wrong token, or with a non-local host is refused and stores nothing; the page closes after one submit and when `close()` runs. FR-SETUP-05-7: after a submit `set` was called once with the value, and the callback receives only where it was stored. FR-SETUP-05-8: when the OS store throws, the key lands in the owner-only file and the callback says "file".

## Build
```ts
export interface KeyPage { readonly url: string; close(): void }
export function openKeyPage(d: {
  secrets: { set(name: string, value: string): Promise<{ where: "os_store" | "file" }> };
  name: string;
  onStored(where: "os_store" | "file"): void;
}): Promise<KeyPage>;
```
The page binds to 127.0.0.1 on a free port. The URL carries a random token. A second `openKeyPage` call invalidates the earlier token.

## Done when
`bun test test/setup/key-page.test.ts`

## Out of scope
- The tool that opens the page and tells the agent: SPEC-05-4.
- Checking that the provider accepts the key: SPEC-05-3.

## Open questions
None.
