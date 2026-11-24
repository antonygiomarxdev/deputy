# SPEC-05-20: The triage token of a chat

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

A port `TriageTokens` and its adapter: `issue(chatId)` returns an HMAC-SHA-256 of the chat id with the secret, as lowercase hex, and `verify(chatId, token)` compares in constant time. The secret is read through a function the composition passes, so a test sets it. The secret never leaves the adapter.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-30 | WHEN | When the session asks for the pending chats, Intake gives each chat a triage token, an HMAC of the chat id with a secret that Deputy keeps. (Proposed, lead decision, ADR-019.) |
| FR-INTAKE-05-34 | always | Intake creates the token secret the first time it is needed and keeps it in the secret store, with the owner-only file as the fallback of ADR-008; the secret never appears in a result, a log or a document. (Proposed, lead decision, ADR-019.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/triage-tokens.ts` | Create | the port |
| `src/intake/adapters/crypto/hmac-triage-tokens.ts` | Create | the HMAC adapter |
| `test/intake/unit/triage-tokens.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/secrets/secret-store.ts` `SecretStore`: the store the composition reads the secret from
- Precedent: docs/adr/ADR-019-dispatcher-session-and-background-helpers.md, the decision this port carries out

## Tests first
FR-INTAKE-05-30, FR-INTAKE-05-34, written before the code, without it in view. FR-INTAKE-05-30: `issue` of the same chat id twice gives the same token; two chat ids give two tokens; the token is 64 lowercase hex characters; `verify` is true for the issued token and false for the token of another chat, for an empty string, for a token with one character changed and for a token of the wrong length. FR-INTAKE-05-34: with another secret an old token fails; the adapter exposes no way to read the secret; `JSON.stringify` of the adapter holds no secret; a secret function that rejects makes `issue` and `verify` reject with a plain error and never return a token.

## Build
```ts
export interface TriageTokens { issue(chatId: ChatId): Promise<string>; verify(chatId: ChatId, token: string): Promise<boolean> }
export class HmacTriageTokens implements TriageTokens { constructor(d: { secret(): Promise<string> }) }
```
SHA-256 through `node:crypto`; compare with `timingSafeEqual` after a length check.

## Done when
`bun test test/intake/unit/triage-tokens.test.ts`

## Out of scope
Where the secret comes from (SPEC-05-26); the tools that carry the token (SPEC-05-25).

## Open questions
None.
