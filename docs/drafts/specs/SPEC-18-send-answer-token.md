# SPEC-18: send_answer refuses a token that is not the chat's

Status: Draft
Rests on: ../frd/FRD-05-pilot-helper-send.md

## Summary

`send_answer` takes a `token` next to the chat id, calls the check first and, on a mismatch, returns `bad_token` and creates and sends nothing. The always-ask list, the window and the knowledge are not read for a refused call.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-05-1 | WHEN | When `send_answer` is called, Deputy shall verify that the triage token belongs to the chat id and shall refuse a token that does not match, creating and sending nothing. (docs/adr/ADR-019, Proposed, lead decision.) |
| FR-DRAFTS-05-2 | WHEN | When `send_answer` is called with a token that belongs to the chat id, Deputy shall go on with the checks of FR-DRAFTS-02-13 (the always-ask list, the knowledge and the customer window) exactly as without a token. (docs/adr/ADR-019, Proposed, lead decision.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/mcp/pilot-tools.ts | Create (SPEC-13 creates it; this spec adds the check) | `token` in the input and the first check |
| src/main/drafts-pilot.ts | Create (SPEC-16-1 creates it; this spec adds the field) | `tokens` in `AutoSendDeps` built from Intake's `TriageTokens` |
| test/drafts/send-answer-token.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-13-pilot-tools.md, the handler this spec extends.
- Precedent: SPEC-17-triage-token-check.md, the check it calls.
- Precedent: SPEC-16-1-pilot-dependencies.md, which builds `autoSendDeps` as one object and says a later spec adds the token check, and SPEC-16-2-register-send-tools.md, whose registration spreads `{ ...d.pilot.autoSendDeps }`, so it needs no change.

## Tests first
- FR-DRAFTS-05-1 (4): given a token that does not belong to the chat id, `send_answer` returns `bad_token`, creates no draft and sends nothing, and does not read the always-ask source or the window.
- FR-DRAFTS-05-2 (1): given the right token, an answer the knowledge backs and an open window, `send_answer` sends as SPEC-13 says.
- FR-DRAFTS-05-1 (6): given the check cannot be made, `send_answer` returns `bad_token`.
- FR-DRAFTS-05-1 (7): given `pilotWiring` with a fake Intake `TriageTokens`, the `autoSendDeps` it returns holds a `tokens` check that is true for a token issued for the chat and false for another chat's token, so the spread of SPEC-16-2 delivers it to the tool.

## Build
```ts
export type SendAnswerInput = { chatId: string; token: string; text: string; answerClass: string; knowledge: string[] };
// AutoSendDeps gains `tokens: TriageTokenCheck`; sendAnswerTool's first step is `tokens.matches(chatId, token)`
// pilotWiring(d) gains `tokens: TriageTokens` (Intake's index export, Intake SPEC-05-26) and sets `autoSendDeps.tokens = new IntakeTriageTokenCheck({ tokens })`
```

## Done when
`bun test test/drafts/send-answer-token.test.ts`

## Out of scope
The decision, the window and the send (SPEC-05, SPEC-06, SPEC-13); the check itself (SPEC-17); the registration, which is unchanged (SPEC-16-2); passing Intake's `triageTokens` through `draftsWiring` and `serve.ts` (SPEC-19).

## Open questions
None.
