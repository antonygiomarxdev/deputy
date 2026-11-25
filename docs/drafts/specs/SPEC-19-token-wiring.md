# SPEC-19: the token reaches send_answer through the server

Status: Draft
Rests on: ../frd/FRD-05-pilot-helper-send.md

## Summary

`draftsWiring` takes Intake's `triageTokens` as an input and passes it to `pilotWiring` (SPEC-18), and `serve.ts` passes `wired.triageTokens` from the Intake wiring. One end-to-end test through the server shows that a wrong token on `send_answer` is refused and nothing is sent.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-05-1 | WHEN | When `send_answer` is called, Deputy shall verify that the triage token belongs to the chat id and shall refuse a token that does not match, creating and sending nothing. (docs/adr/ADR-019, Proposed, lead decision.) |
| FR-DRAFTS-05-2 | WHEN | When `send_answer` is called with a token that belongs to the chat id, Deputy shall go on with the checks of FR-DRAFTS-02-13 (the always-ask list, the knowledge and the customer window) exactly as without a token. (docs/adr/ADR-019, Proposed, lead decision.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/main/drafts.ts | Change | `draftsWiring` takes `tokens` and passes it to `pilotWiring` |
| src/main/serve.ts | Change | passes `wired.triageTokens` to `draftsWiring` |
| test/e2e/send-answer-token.test.ts | Create | The end-to-end cases below |

## Reuses
- `src/main/serve.ts` `serve`: the start sequence, top to bottom (ADR-013)
- Precedent: SPEC-16-4-start-order.md, which fixes the order of Intake, Knowledge and Drafts in `serve`
- Precedent: SPEC-18-send-answer-token.md, which adds `tokens` to `autoSendDeps`
- Precedent: docs/intake/specs/SPEC-05-26-triage-wiring.md, which returns `triageTokens` from `intakeWiring`

## Tests first
- FR-DRAFTS-05-1 (8): given the server over standard input and output on temporary folders and the dev provider, a customer message in chat A and another in chat B, `list_pending` gives each chat its own `triageToken`; `send_answer` for chat B with the token of chat A returns `bad_token`, and the provider records no send and no draft exists.
- FR-DRAFTS-05-1 (9): the same call with an empty token and with a token of the wrong length is refused.
- FR-DRAFTS-05-2 (2): with the knowledge saved so that it backs the answer and the class outside the always-ask list, `send_answer` for chat A with the token of chat A sends one message to chat A and none to chat B.

## Build
```ts
// draftsWiring(d: { ..., tokens: TriageTokens }) → pilotWiring({ ..., tokens })
// serve.ts: await draftsWiring({ ..., tokens: wired.triageTokens })   // the member intakeWiring returns (Intake SPEC-05-26)
```

## Done when
`bun test test/e2e/send-answer-token.test.ts`

## Out of scope
The check and the handler (SPEC-17, SPEC-18); the token and its secret (Intake SPEC-05-20 and SPEC-05-26); the rest of the start order (SPEC-16-4).

## Open questions
None.
