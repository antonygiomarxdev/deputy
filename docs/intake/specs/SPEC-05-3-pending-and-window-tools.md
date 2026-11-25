# SPEC-05-3: The tools that show the pending list and each window

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

Registers `list_pending` and adds `windowClosesAt` to the customer chat that `get_chat` returns. Both are reads: no lease. The window is computed on read from the customer's latest message (TP-05 TD-4).

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-12 | always | Each customer chat shall show when its customer 24 hour window closes: 24 hours after the customer's latest message. |
| FR-INTAKE-05-13 | WHEN | When the session asks for the pending chats, Intake shall list each chat whose latest customer message is newer than its latest answer, inside the pending window of FR-INBOX-01-6, newest first, each with the time its customer window closes. The control chat shall never be listed. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/adapters/mcp/intake-tools.ts` | Change | the `list_pending` tool and `windowClosesAt` in `get_chat` |
| `src/main/tools.ts` | Change | passes `listPending` to `intakeTools` |
| `test/intake/unit/pending-tools.test.ts` | Create | the tests below |

## Reuses
- `src/intake/adapters/mcp/intake-tools.ts` `intakeTools`: where `get_chat` and `check_messages` are registered
- `src/main/tools.ts` `mcpServer`: the list of tools the server offers
- Precedent: SPEC-05-2-list-pending.md, the use case this tool calls

## Tests first
FR-INTAKE-05-12, FR-INTAKE-05-13, written before the code, without it in view, through the tool definitions with a fake `ListPending` and `ReadChat`. FR-INTAKE-05-12: `get_chat` for a customer chat shows `windowClosesAt` as 24 hours after the latest customer message, and none for the control chat. FR-INTAKE-05-13: `list_pending` returns what the use case returns, with times as ISO text, newest first, and the tool needs no lease.

## Build
```ts
// intakeTools gains the dependency: listPending: ListPending
// tool "list_pending": input {}, output [{ chat, lastCustomerAt, windowClosesAt }] with ISO times
```
The tool's description says what it is for: the chats waiting for an answer, with the time each customer window closes.

## Done when
`bun test test/intake/unit/pending-tools.test.ts`

## Out of scope
The use case (SPEC-05-2). Showing the open questions in `get_chat` (SPEC-05-8).

## Open questions
None.
