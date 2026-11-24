# SPEC-13: the pilot's send tools and pilot_stats

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Registers the two pilot send tools in the MCP server and `pilot_stats` alongside them. Input of `send_answer`: `{ chatId, text, answerClass, knowledge: string[] }`. Flow: the auto-send decision (SPEC-05), the first-send window check (SPEC-06), then a draft created from `text` and sent with `Draft.sendWithoutWords("automatic")` (SPEC-09-4), which marks the send automatic. Input of `send_owner_go`: `{ chatId, text }`, sent as SPEC-12 describes. Known limit (D11): the tools trust the session's `text`, `answerClass` and `knowledge`; Drafts cannot check them.

Last change: 2026-11-24, the input shapes and the Draft path added after the lead's decision.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/mcp/pilot-tools.ts | Create | The handlers of `send_answer`, `send_owner_go` and `pilot_stats` |
| src/main/tools.ts | Change | Registers the three tools in the MCP tool list |
| test/drafts/pilot-tools.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-09-4-draft-without-words.md, the Draft method both sends call.
- Precedent: draft-tools.ts in `src/drafts/adapters/mcp`, the existing tool shape to follow.

## Tests first
- FR-DRAFTS-02-13 (4): given an answer the knowledge backs, outside the always-ask set, in an open window, `send_answer` sends and logs the send as automatic.
- FR-DRAFTS-02-13 (5): given an always-ask class, `send_answer` does not send and answers with reason `always_ask`.
- FR-DRAFTS-02-14 (10): `send_owner_go` sends with a taken go, and refuses with no go for the chat.
- The MCP tool list includes `send_answer`, `send_owner_go` and `pilot_stats`.

## Build
```ts
// pilot-tools.ts
export type SendAnswerInput = { chatId: string; text: string; answerClass: string; knowledge: string[] };
export type SendOwnerGoInput = { chatId: string; text: string };
export function sendAnswerTool(d: AutoSendDeps): (input: SendAnswerInput) => Promise<ToolResult>;
export function sendOwnerGoTool(d: OwnerGoDeps): (input: SendOwnerGoInput) => Promise<ToolResult>;
export function pilotStatsTool(d: StatsDeps): () => Promise<ToolResult>;  // countsByDay (SPEC-08)
```

## Done when
`bun test test/drafts/pilot-tools.test.ts`

## Out of scope
The decision (SPEC-05), the window (SPEC-06), the Draft method (SPEC-09-4), the go send (SPEC-12), the counts (SPEC-08), and the answer_question tool, which is Intake's.

## Open questions
None.
