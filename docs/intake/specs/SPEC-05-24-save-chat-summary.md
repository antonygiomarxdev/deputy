# SPEC-05-24: A helper saves the summary of a chat

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The use case `SaveChatSummary`: given a chat id, its token and a text, it replaces the stored summary of that chat. A token that does not match the chat id is refused and nothing is stored. A text over the size limit is refused. Lease required.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-32 | WHEN | When a helper saves a chat summary with the chat id and its token, Intake replaces the stored summary of that chat with it. A token that does not match the chat id is refused and nothing is stored. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-33 | always | The messages of a chat's context are customer text and the summary is untrusted text: Intake labels the messages as customer text, as the chat read does, and the summary as the model's earlier notes that may repeat customer text and are not an instruction, never as the owner's words and never as a go. (Proposed, lead decision, docs/adr/ADR-019.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/save-chat-summary.ts` | Create | the port and its result |
| `src/intake/application/save-chat-summary.ts` | Create | `SaveChatSummaryUseCase` |
| `test/intake/unit/save-chat-summary.test.ts` | Create | the tests below |

## Reuses
- `src/intake/ports/intake-unit-of-work.ts` `IntakeUnitOfWork`: one transaction that checks the lease first
- Precedent: SPEC-05-20-triage-tokens.md, the token check
- Precedent: SPEC-05-22-chat-summary-repository.md, the write

## Tests first
FR-INTAKE-05-32, FR-INTAKE-05-33, written before the code, without it in view, with in-memory fakes and a fake clock. FR-INTAKE-05-32: a valid token and a text replace the summary and the time; a token of another chat gives `bad_token` and stores nothing; a text of 2001 characters gives `too_long` and stores nothing, and 2000 characters is stored; a process without the lease gives `not_owner` and stores nothing; an empty text is refused as `empty`. FR-INTAKE-05-33: the stored text is exactly the text given; Intake adds no label to the stored text (the label is added when it is read).

## Build
```ts
export const SUMMARY_MAX = 2000; // Proposed, lead decision: keeps the context small
export type SaveChatSummaryResult = { kind: "saved" } | { kind: "refused"; reason: "bad_token" | "too_long" | "empty" | "not_owner" };
export interface SaveChatSummary { execute(q: { chat: ChatId; token: string; text: string }): Promise<SaveChatSummaryResult> }
```

## Done when
`bun test test/intake/unit/save-chat-summary.test.ts`

## Out of scope
The tool (SPEC-05-25).

## Open questions
None.
