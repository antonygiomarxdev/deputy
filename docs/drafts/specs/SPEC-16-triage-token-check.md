# SPEC-16: the triage token check

Status: Draft
Rests on: ../frd/FRD-05-pilot-helper-send.md

## Summary

A port `TriageTokenCheck` and its adapter over Intake's published `TriageTokens`: `matches(chatId, token)` is true only when the token was issued for that chat id. Drafts never sees the secret and reads no Intake table.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-05-1 | WHEN | When `send_answer` is called, Deputy shall verify that the triage token belongs to the chat id and shall refuse a token that does not match, creating and sending nothing. (ADR-019, Proposed, lead decision.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/ports/triage-token-check.ts | Create | The `TriageTokenCheck` port |
| src/drafts/adapters/intake/intake-token-check.ts | Create | The adapter over Intake's `TriageTokens` |
| test/drafts/intake-token-check.test.ts | Create | The tests below |

## Reuses
- Precedent: docs/intake/specs/SPEC-05-24-triage-wiring.md, which exports `TriageTokens` from the Intake index.
- Precedent: SPEC-17-send-answer-token.md, the handler that calls the check.

## Tests first
- FR-DRAFTS-05-1 (1): given a token issued for chat "c1", `matches("c1", token)` is true and `matches("c2", token)` is false.
- FR-DRAFTS-05-1 (2): given an empty token or a token of the wrong length, `matches` is false and does not throw.
- FR-DRAFTS-05-1 (3): given Intake's check throws, `matches` is false (the send is refused, never allowed on an error).

## Build
```ts
export interface TriageTokenCheck { matches(chatId: string, token: string): Promise<boolean> }
export class IntakeTriageTokenCheck implements TriageTokenCheck { constructor(d: { tokens: TriageTokens }) }
```

## Done when
`bun test test/drafts/intake-token-check.test.ts`

## Out of scope
The handler (SPEC-17), the token and the secret (Intake SPEC-05-18 and SPEC-05-24), and the wiring that passes the Intake export to the handler.

## Open questions
None.
