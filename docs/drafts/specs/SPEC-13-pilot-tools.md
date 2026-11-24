# SPEC-13: the pilot's send tools

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Builds the handlers of the two pilot send tools; registering them in the tool list is SPEC-16-2 and `pilot_stats` is SPEC-15. `send_answer` input: `{ chatId, text, answerClass, knowledge: string[] }`. It reads the always-ask list from Knowledge through `AlwaysAskSource` (not from the session), decides (SPEC-05), checks the window (SPEC-06), then approves and sends through SPEC-09-4 and the existing driveSend. `send_owner_go` input: `{ chatId, text }`, sent as SPEC-12 describes. Known limit (D11): the tools trust `text`, `answerClass` and `knowledge`; Drafts cannot check them.

Last change: 2026-11-24, the registration in src/main/tools.ts moved to SPEC-16-2, which builds the dependency bundles the handlers take.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/mcp/pilot-tools.ts | Create | The handlers of `send_answer` and `send_owner_go` |
| test/drafts/pilot-tools.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-09-4-draft-without-words.md, the approval method both sends call.
- Precedent: draft-tools.ts in `src/drafts/adapters/mcp`, the existing tool shape to follow.

## Tests first
- FR-DRAFTS-02-13 (4): given an answer the knowledge backs, outside the always-ask set, in an open window, `send_answer` sends and the approval basis is `automatic`.
- FR-DRAFTS-02-13 (5): given an always-ask class, `send_answer` does not send and answers with reason `always_ask`.
- FR-DRAFTS-02-13 (21): given the Knowledge always-ask list containing "Delivery price" and a session answerClass "delivery price", `send_answer` does not send: the list comes from Knowledge, not the session.
- FR-DRAFTS-02-14 (10): `send_owner_go` sends with a taken go, and refuses with no go for the chat.
- FR-DRAFTS-02-14 (22): given a closed customer window, `send_owner_go` sends nothing, and the result tells the owner (`window_closed`); the go stays stored.

## Build
```ts
export type SendAnswerInput = { chatId: string; text: string; answerClass: string; knowledge: string[] };
export type SendOwnerGoInput = { chatId: string; text: string };
export function sendAnswerTool(d: { alwaysAsk: AlwaysAskSource } & AutoSendDeps): (input: SendAnswerInput) => Promise<ToolResult>;
export function sendOwnerGoTool(d: OwnerGoDeps): (input: SendOwnerGoInput) => Promise<ToolResult>;
```
`pilot_stats` is SPEC-15's.

## Done when
`bun test test/drafts/pilot-tools.test.ts`

## Out of scope
The decision (SPEC-05), the window (SPEC-06), the approval method (SPEC-09-4), the go send (SPEC-12), the counts (SPEC-08), the always-ask file (Knowledge), the answer_question tool (Intake), and registering the two tools in the tool list (SPEC-16-2).

## Open questions
None.
