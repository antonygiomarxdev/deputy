# SPEC-05-26: The composition builds the token, the summary and the context

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The composition root builds `HmacTriageTokens` with a secret it creates the first time and keeps in the secret store, builds the summary repository and the two use cases, and exports `TriageTokens` from the Intake index so that Drafts can verify a token without reading Intake's tables.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-34 | always | Intake creates the token secret the first time it is needed and keeps it in the secret store, with the owner-only file as the fallback of ADR-008; the secret never appears in a result, a log or a document. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-30 | WHEN | When the session asks for the pending chats, Intake gives each chat a triage token, an HMAC of the chat id with a secret that Deputy keeps. (Proposed, lead decision, docs/adr/ADR-019.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/intake.ts` | Change | builds the tokens, the repository and the use cases |
| `src/intake/index.ts` | Change | exports `TriageTokens` and the two ports |
| `test/intake/unit/triage-wiring.test.ts` | Create | the tests below |

## Reuses
- `src/main/intake.ts` `intakeWiring`: where the intake runtime and its repositories are built
- `src/adapters/secrets/secret-store.ts` `createSecretStore`: the store and its owner-only file fallback
- Precedent: SPEC-05-15-pilot-wiring.md, the wiring this spec extends

## Tests first
FR-INTAKE-05-34, FR-INTAKE-05-30, written before the code, without it in view, with a fake secret store and an in-memory database. FR-INTAKE-05-34: the first `issue` creates a secret of at least 32 random bytes and stores it under one name; a second process start reads the same secret and issues the same token; a store that is unavailable falls back to the owner-only file; no result, log line or error holds the secret. FR-INTAKE-05-30: `tools/list` holds `chat_context` and `save_chat_summary`, and the Intake index exports `TriageTokens`.

## Build
`intakeWiring` builds `HmacTriageTokens({ secret })` where `secret` reads the secret store entry `triage_secret` and, when it is missing, writes 32 random bytes as hex and returns them. The index adds `export type { TriageTokens }`, `ChatContext` and `SaveChatSummary`.

## Done when
`bun test test/intake/unit/triage-wiring.test.ts`

## Out of scope
The tools themselves (SPEC-05-25); the secret store adapter (ADR-008).

## Open questions
None.
