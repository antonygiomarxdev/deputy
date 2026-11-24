# SPEC-13: the pilot's send tools: send_answer and send_owner_go

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Registers the two pilot send tools in the MCP server. `send_answer` runs the auto-send decision (SPEC-05), the first-send window check (SPEC-06), then the send with the automatic mark (SPEC-09). `send_owner_go` sends with a taken go (SPEC-12). `pilot_stats` is registered in the same file and returns SPEC-08's counts.

Last change: 2026-11-24, after the lead's review: split of the migration specs, the tools spec added.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/mcp/pilot-tools.ts | Create | The handlers of `send_answer`, `send_owner_go` and `pilot_stats` |
| src/main/tools.ts | Change | Registers the three tools in the MCP tool list |
| test/drafts/pilot-tools.test.ts | Create | The tests for the tools below |

## Reuses
- Precedent: SPEC-03-safe-send.md, whose send path `send_answer` calls for an automatic send; `src/drafts/adapters/mcp/draft-tools.ts` is the existing tool shape to follow.

## Tests first
- FR-DRAFTS-02-13 (4): given an answer the knowledge backs, outside the always-ask set, in an open window, `send_answer` sends and logs the send as automatic.
- FR-DRAFTS-02-13 (5): given an always-ask class, `send_answer` does not send and answers with reason `always_ask`.
- FR-DRAFTS-02-14 (10): `send_owner_go` sends with a taken go, and refuses with no go for the chat.
- The MCP tool list includes `send_answer`, `send_owner_go` and `pilot_stats`.

## Build
```ts
// pilot-tools.ts
export function sendAnswerTool(d: AutoSendDeps): ToolHandler;    // decideAutoSend, checkFirstSend, then send with automatic = true
export function sendOwnerGoTool(d: OwnerGoDeps): ToolHandler;   // sendWithOwnerGo (SPEC-12)
export function pilotStatsTool(d: StatsDeps): ToolHandler;      // countsByDay (SPEC-08)
```

## Done when
`bun test test/drafts/pilot-tools.test.ts`

## Out of scope
The decision (SPEC-05), the window (SPEC-06), the automatic mark (SPEC-09), the go send (SPEC-12), the counts (SPEC-08), and the answer_question tool, which is Intake's.

## Open questions
None.
