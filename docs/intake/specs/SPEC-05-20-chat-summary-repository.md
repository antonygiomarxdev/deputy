# SPEC-05-20: The repository of the chat summaries

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The outbound port `ChatSummaryRepository` and its SQLite adapter over the table of SPEC-05-19: read the summary of a chat and replace it.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-32 | WHEN | When a helper saves a chat summary with the chat id and its token, Intake replaces the stored summary of that chat with it. A token that does not match the chat id is refused and nothing is stored. (Proposed, lead decision, ADR-019.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/chat-summary-repository.ts` | Create | the port |
| `src/intake/adapters/sqlite/sqlite-chat-summary-repository.ts` | Create | the SQLite adapter |
| `test/intake/contract/chat-summary-repository.contract.test.ts` | Create | the tests below |

## Reuses
- `src/shared/sql-database.ts` `SqlExecutor`: the port the adapter writes through
- Precedent: SPEC-05-5-owner-question-repository.md, a small SQLite repository of the pilot

## Tests first
FR-INTAKE-05-32, written before the code, without it in view, on an in-memory SQLite database with the migrations. FR-INTAKE-05-32: `get(chat)` is null before any save; `replace(chat, text, at)` stores the text and the time; a second `replace` for the same chat replaces the text and keeps one row; another chat's summary is not touched.

## Build
```ts
export interface ChatSummary { text: string; updatedAt: Instant }
export interface ChatSummaryRepository {
  get(chat: ChatId): Promise<ChatSummary | null>;
  replace(chat: ChatId, text: string, at: Instant): Promise<void>;
}
```

## Done when
`bun test test/intake/contract/chat-summary-repository.contract.test.ts`

## Out of scope
The use cases (SPEC-05-21, SPEC-05-22).

## Open questions
None.
