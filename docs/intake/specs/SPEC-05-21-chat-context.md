# SPEC-05-21: The chat context a helper reads

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The read use case `ChatContext`: given a chat id and its token, it returns at most the last 20 messages of that chat and the stored summary, with the summary labeled as untrusted notes. A token that does not match the chat id is refused. A read; it needs no lease.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-31 | WHEN | When a helper asks for a chat's context with the chat id and its token, Intake returns at most the last 20 messages of that chat and the stored summary of that chat. A token that does not match the chat id is refused and nothing is returned. (Proposed, lead decision, ADR-019.) |
| FR-INTAKE-05-33 | always | The summary is untrusted text: Intake labels it as the model's earlier notes, never as the owner's words and never as a go. (Proposed, lead decision, ADR-019.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/chat-context.ts` | Create | the `ChatContext` port and its result |
| `src/intake/application/chat-context.ts` | Create | `ChatContextUseCase` |
| `test/intake/unit/chat-context.test.ts` | Create | the tests below |

## Reuses
- `src/intake/ports/message-repository.ts` `MessageRepository`: `listChat` reads the newest messages of a chat
- `src/intake/ports/views.ts` `MessageView`: the message shape the session already reads
- Precedent: SPEC-05-18-triage-tokens.md, the check this use case calls
- Precedent: SPEC-05-20-chat-summary-repository.md, the summary it reads

## Tests first
FR-INTAKE-05-31, FR-INTAKE-05-33, written before the code, without it in view, with in-memory fakes. FR-INTAKE-05-31: with 30 messages in the chat the result holds the newest 20, oldest first; with 5 it holds 5; with no summary the summary is null; a token of another chat gives `refused` with `bad_token` and the fakes were not read; an unknown chat gives `unknown_chat`; messages of another chat never appear. FR-INTAKE-05-33: the summary is returned inside `summary: { text, label }` where the label says it is the model's earlier notes and not the owner's words and not a go, and the summary text is never put in the messages list.

## Build
```ts
export const CONTEXT_MESSAGES = 20;
export type ChatContextResult =
  | { kind: "context"; messages: MessageView[]; summary: { text: string; updatedAt: Instant; label: string } | null }
  | { kind: "refused"; reason: "bad_token" | "unknown_chat" };
export interface ChatContext { execute(q: { chat: ChatId; token: string }): Promise<ChatContextResult> }
```

## Done when
`bun test test/intake/unit/chat-context.test.ts`

## Out of scope
The tool (SPEC-05-23); saving a summary (SPEC-05-22).

## Open questions
None.
