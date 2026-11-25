# SPEC-09-6b-1: the drafts log has a basis column

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Migration 0007 adds `drafts_log.basis` (default `owner_words`), rebuilds the ADR-010 update trigger with `basis` and `automatic` (0004) in its equality list, and is registered after 0006 (depends on SPEC-09-3c and SPEC-09-5a).

Last change: 2026-11-24, split so each run has at most three files, test files included.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner shall be able to check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval shall keep empty owner words and basis automatic; Deputy shall report it as automatic, not as an owner approval, and the log shall show each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/migrations/0007-log-basis.sql | Create | Adds `basis TEXT NOT NULL DEFAULT 'owner_words'` and rebuilds the ADR-010 `BEFORE UPDATE` trigger with `basis` and `automatic` in its equality list |
| src/main/database.ts | Change | Registers 0007-log-basis.sql at the end of the migration list, after 0006 |
| test/drafts/contract/log-basis.sqlite.test.ts | Create | The tests below; they open the database with `openDatabase` from `src/main/database.ts`, so they need no test helper |

## Reuses
- Precedent: SPEC-09-3a-automatic-migration.md, the same trigger rebuild for `automatic`; SPEC-09-3c-automatic-registration.md, the registration and the version check by position.

## Tests first
- FR-DRAFTS-04-5 (15): after the migration, `drafts_log` has `basis` with default `owner_words`.
- FR-DRAFTS-04-5 (16): the ADR-010 trigger refuses an update that changes `basis` or `automatic`; the scrub update still passes.
- FR-DRAFTS-04-5 (17): after open, `user_version` equals the position of 0007 in the list (the list length before 0007, plus one).

## Build
```sql
ALTER TABLE drafts_log ADD COLUMN basis TEXT NOT NULL DEFAULT 'owner_words';
-- drop and recreate the BEFORE UPDATE trigger of ADR-010 with basis and automatic in its equality list
```

## Done when
`bun test test/drafts/contract/log-basis.sqlite.test.ts`

## Out of scope
The repository reads and writes (SPEC-09-6b-2) and the mapper (SPEC-09-6a-2).

## Open questions
None.
