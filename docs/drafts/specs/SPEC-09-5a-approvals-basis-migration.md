# SPEC-09-5a: the approvals basis column and its registration

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

Adds `approvals.basis` (default `owner_words`, so existing approvals read unchanged) and registers the migration. The ADR-010 trigger covers drafts_log only, so approvals need no trigger change. The repository reads and writes it in SPEC-09-5b.

Last change: 2026-11-24, after the lead's decision: approveWithoutWords and an approval that records its basis.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/migrations/0006-approvals-basis.sql | Create | `ALTER TABLE approvals ADD COLUMN basis TEXT NOT NULL DEFAULT 'owner_words';` |
| src/main/database.ts | Change | Registers 0006-approvals-basis.sql at the end of the migration list, after 0004 (SPEC-09-3c) and 0005 (SPEC-10-1); Intake's 0008 is registered before all of them |
| test/drafts/contract/approvals-basis-migration.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-09-3c-automatic-registration.md, which registers a migration at the end of the list and checks `user_version` by position.

## Tests first
- FR-DRAFTS-02-14 (13): after the migration, an approval inserted without `basis` reads back with `basis` = 'owner_words'.
- FR-DRAFTS-02-14 (14): after open, `user_version` equals the position of 0006 in the migration list (the list length before 0006, plus one).

## Build
```sql
ALTER TABLE approvals ADD COLUMN basis TEXT NOT NULL DEFAULT 'owner_words';
```

## Done when
`bun test test/drafts/contract/approvals-basis-migration.test.ts`

## Out of scope
The repository's reads and writes (SPEC-09-5b) and the approval method (SPEC-09-4).

## Open questions
None.
