# TP-01-draft-lifecycle: Interfaces

Part of [TP-01-draft-lifecycle.md](../tp/TP-01-draft-lifecycle.md). Moved verbatim from there; nothing changed.

## Interfaces

Inbound ports above. MCP tools this FRD adds (zod schemas; every tool also returns a plain-text rendering):

| Tool | Input | Output | Use case |
|---|---|---|---|
| `create_draft` | `{ kind?: 'reply' \| 'order' (default 'reply'), chat: string, text?: string, order?: object }`; `text` is required for a reply, `order` for an order | draft number, state, text, the message it answers, and "replaced draft N" when it replaced one | `CreateDraft` |
| `list_drafts` | `{ chat?: string }` | drafts with number, kind, chat, state, text, the message answered (labeled `<customer_text>`), the "catalog changed" mark, hold or fail reason; "no drafts waiting" when empty | `ListDrafts` |
| `change_draft` | `{ number: int, text?: string, order?: object, owner_words: string }` | number, state "waiting", and whether an approval was voided | `ChangeDraft` |
| `reject_draft` | `{ number: int, owner_words: string }` | number, state "rejected" | `RejectDraft` |

`WaitingChats` is called by Inbox's adapter, not by a tool. Cross-slice calls: Intake (`ChatExists`, `ReadChat`) and Orders (`PrepareOrder`) through the ports above. Refusals are plain text: "draft 4 does not exist", "draft 4 is closed (sent)", "that chat has only test messages".
