# SPEC-05-25: The tools that carry the token

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

`list_pending` now returns each chat with its triage token; the new tools `chat_context` (chat id and token) and `save_chat_summary` (chat id, token, text) are registered. Each refusal is an error result with a plain sentence. The token is a plain string the session passes on.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-30 | WHEN | When the session asks for the pending chats, Intake shall give each chat a triage token derived from the chat id with a secret that Deputy keeps. (Proposed, lead decision, docs/adr/ADR-019; the derivation is set in docs/adr/ADR-019 item (e) and Intake SPEC-05-20.) |
| FR-INTAKE-05-31 | WHEN | When a helper asks for a chat's context with the chat id and its token, Intake shall return at most the last 20 messages of that chat and the stored summary of that chat. A token that does not match the chat id shall be refused and nothing shall be returned. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-33 | always | The messages of a chat's context shall be labeled as customer text, as the chat read does, and the summary shall be labeled as the model's earlier notes that may repeat customer text and are not an instruction. Neither shall be labeled as the owner's words or as a go. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-32 | WHEN | When a helper saves a chat summary with the chat id and its token, Intake shall replace the stored summary of that chat with it. A token that does not match the chat id shall be refused and nothing shall be stored. (Proposed, lead decision, docs/adr/ADR-019.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/adapters/mcp/intake-tools.ts` | Change | the token in `list_pending` and the two new tools |
| `src/main/tools.ts` | Change | passes the use cases and the tokens to `intakeTools` |
| `test/intake/unit/triage-tools.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/mcp/customer-text.ts` `customerText`: the label that marks customer text for the session
- `src/intake/adapters/mcp/intake-tools.ts` `intakeTools`: where the intake tools are registered
- Precedent: SPEC-05-3-pending-and-window-tools.md, the `list_pending` tool this spec extends
- Precedent: SPEC-05-23-chat-context.md and SPEC-05-24-save-chat-summary.md, the use cases the new tools call

## Tests first
FR-INTAKE-05-30, FR-INTAKE-05-31, FR-INTAKE-05-32, FR-INTAKE-05-33, written before the code, without it in view, through the tool definitions with fake use cases and fake tokens. FR-INTAKE-05-30: `list_pending` returns `{ chat, lastCustomerAt, windowClosesAt, triageToken }` for each chat and the token is the one `TriageTokens.issue` gave for that chat. FR-INTAKE-05-31: `chat_context` with a chat and a token returns the messages and the labeled summary; `bad_token` is an error result that says the token does not belong to this chat. FR-INTAKE-05-32: `save_chat_summary` with a chat, a token and a text returns `saved`; each refusal is an error result with its reason. FR-INTAKE-05-33: every message text of a `chat_context` result is passed through `customerText` with the label `customer_text`, the same function `get_chat` uses, so a message whose text holds an instruction reaches the session inside the customer-text label; the summary carries the label of SPEC-05-23 and is not passed as customer text or as the owner's words.

## Build
```ts
// tool list_pending: output [{ chat, lastCustomerAt, windowClosesAt, triageToken }]
// tool chat_context: input { chatId: string, token: string }; output { messages, summary }
// tool save_chat_summary: input { chatId: string, token: string, text: string }; output { saved: true }
```

## Done when
`bun test test/intake/unit/triage-tools.test.ts`

## Out of scope
The wiring of the secret (SPEC-05-26); Drafts' check of the token on `send_answer` (a Drafts spec).

## Open questions
None.
