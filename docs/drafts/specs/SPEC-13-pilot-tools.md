# SPEC-13: the pilot's send tools and the pilot_stats registration

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Registers the two pilot send tools in the MCP server; `pilot_stats` is SPEC-15. `send_answer` input: `{ chatId, text, answerClass, knowledge: string[] }`. It reads the always-ask list from Knowledge through `AlwaysAskSource` (not from the session), decides (SPEC-05), checks the window (SPEC-06), then approves and sends through SPEC-09-4 and the existing driveSend. `send_owner_go` input: `{ chatId, text }`, sent as SPEC-12 describes. Known limit (D11): the tools trust `text`, `answerClass` and `knowledge`; Drafts cannot check them.

Last change: 2026-11-24, after the review of 7a56758: the go is one unit of work with its approval; closed window tells the owner; the always-ask list comes from Knowledge; reconcile on start; the basis is in the log read; pilotStatsTool is in the application layer.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/mcp/pilot-tools.ts | Create | The handlers of `send_answer` and `send_owner_go` |
| src/main/tools.ts | Change | Registers the two send tools |
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
- The MCP tool list includes `send_answer` and `send_owner_go`.

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
The decision (SPEC-05), the window (SPEC-06), the approval method (SPEC-09-4), the go send (SPEC-12), the counts (SPEC-08), the always-ask file (Knowledge), and the answer_question tool (Intake).

## Open questions
None.
