# SPEC-09-6b: the drafts log stores the basis of approved entries

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Adds `drafts_log.basis` (default `owner_words`), rebuilds the ADR-010 update trigger with it in the equality list, and registers migration 0007 after 0006 (depends on SPEC-09-6a and SPEC-09-5a).

Last change: 2026-11-24, after the review of 7a56758: the approved entry carries the basis; CheckApprovals runs on the real use case; the approval port gains approvalsBetween. Split so each run has at most 3 files.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner can check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval keeps empty owner words and basis automatic; Deputy reports it as automatic, not as an owner approval, and the log shows each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/migrations/0007-log-basis.sql | Create | Adds `basis TEXT NOT NULL DEFAULT 'owner_words'` to drafts_log and rebuilds the ADR-010 `BEFORE UPDATE` trigger with `basis` in its equality list |
| src/drafts/adapters/sqlite/sqlite-draft-log-repository.ts | Change | `COLUMNS` includes `basis`; the row mapper reads it |
| src/main/database.ts | Change | Registers 0007-log-basis.sql at the end of the migration list |

## Reuses
- Precedent: SPEC-09-3a-automatic-migration.md, the same trigger rebuild for the `automatic` column; SPEC-09-3c-automatic-registration.md, the registration and the version check by position.

## Tests first
- FR-DRAFTS-04-5 (12): after the migration, `drafts_log` has `basis` with default `owner_words`.
- FR-DRAFTS-04-5 (13): an approved entry appended with `basis: "owner_go"` reads back with that basis.
- FR-DRAFTS-04-5 (14): the ADR-010 trigger refuses an update that changes `basis`; after open, `user_version` equals the position of 0007 in the list.

## Build
```sql
ALTER TABLE drafts_log ADD COLUMN basis TEXT NOT NULL DEFAULT 'owner_words';
-- drop and recreate the BEFORE UPDATE trigger of ADR-010 with basis in its equality list
```

## Done when
`bun test test/drafts/contract/log-basis.sqlite.test.ts`

## Out of scope
The mapper and the event (SPEC-09-6a), the read and the audit (SPEC-09-6c).

## Open questions
None.
