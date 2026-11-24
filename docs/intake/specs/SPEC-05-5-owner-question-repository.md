# SPEC-05-5: The repository of the owner's questions

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The outbound port `OwnerQuestionRepository` and its SQLite adapter over the table of SPEC-05-4: add a question and get its number, list the open ones for an owner chat, and link a reply to a question (closing it). It takes part in the unit of work like the other repositories.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-9 | WHEN | When a message arrives in the control chat and names the number of an open question, Intake links the message to that question and closes it. |
| FR-INTAKE-05-10 | IF | If a message in the control chat names no question, Intake links it to the latest open question for that owner number; with none open, it is an instruction and links to nothing. |
| FR-INTAKE-05-11 | always | When the session reads the control chat, each message shows the question it answers, if any, and the session can list the open questions. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/owner-question-repository.ts` | Create | the port and `OwnerQuestion` |
| `src/intake/adapters/sqlite/sqlite-owner-question-repository.ts` | Create | the SQLite adapter |
| `test/intake/contract/owner-question-repository.contract.test.ts` | Create | the tests below |

## Reuses
- `src/intake/adapters/sqlite/sqlite-pending-changes-reader.ts` `SqlitePendingChangesReader`: the shape of a small SQLite repository over `SqlExecutor`
- `src/shared/sql-database.ts` `SqlExecutor`: the port the adapter writes through
- Precedent: SPEC-05-4-owner-questions-table.md, the table this adapter uses

## Tests first
FR-INTAKE-05-9, FR-INTAKE-05-10, FR-INTAKE-05-11, written before the code, without it in view, on an in-memory SQLite database with the migrations. FR-INTAKE-05-9: `link(number, messageId, at)` sets the message and closes the question, and returns false for a question that does not exist or is already closed. FR-INTAKE-05-10: `latestOpen(ownerChat)` returns the newest open question of that chat and null when none is open; another chat's questions are not returned. FR-INTAKE-05-11: `listOpen(ownerChat)` returns the open questions oldest first, and a closed one is gone from it.

## Build
```ts
export interface OwnerQuestion { number: number; ownerChat: ChatId; text: string; askedAt: Instant; sendId: string; linkedMessage: string | null; closedAt: Instant | null }
export interface OwnerQuestionRepository {
  add(q: { ownerChat: ChatId; text: string; askedAt: Instant; sendId: string }): Promise<number>;
  listOpen(ownerChat: ChatId): Promise<OwnerQuestion[]>;
  latestOpen(ownerChat: ChatId): Promise<OwnerQuestion | null>;
  link(number: number, messageId: string, at: Instant): Promise<boolean>;
}
```

## Done when
`bun test test/intake/contract/owner-question-repository.contract.test.ts`

## Out of scope
Adding the repository to `IntakeRepos` and to `test/support/intake-subjects.ts` (SPEC-05-6 and SPEC-05-7 do it where they first use it). An in-memory adapter: the pilot's tests use the SQLite adapter on an in-memory database.

## Open questions
None.
