# SPEC-09-3a: the automatic column and its trigger

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Adds the `automatic` column to drafts_log and rebuilds the ADR-010 update trigger so the column is compared like the others (depends on SPEC-09-2). The repository and the registration follow in SPEC-09-3b and SPEC-09-3c.

Last change: 2026-11-24, after the lead's review: split of the migration specs, the tools spec added.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/adapters/sqlite/migrations/0004-automatic.sql | Create | Adds `automatic INTEGER NOT NULL DEFAULT 0` and rebuilds the ADR-010 `BEFORE UPDATE` trigger with `automatic` in its equality list |
| test/drafts/contract/log-database.ts | Change | Lists migration 0004 among the migrations it opens, so the test database has the column |
| test/drafts/contract/log-triggers.sqlite.test.ts | Change | Adds the trigger cases below to the existing sqlite trigger tests |

## Reuses
- `docs/drafts/adr/ADR-010-scrub-trigger-guard.md` `trigger`: the decision whose trigger this migration rebuilds.

## Tests first
- FR-DRAFTS-04-11 (1): after the migration, `drafts_log` has `automatic` with default 0.
- FR-DRAFTS-04-11 (2): the ADR-010 scrub update (`scrubbed` 0 to 1) is allowed and leaves `automatic` unchanged.
- FR-DRAFTS-04-11 (3): an update that changes `automatic` is refused by the trigger.

## Build
```sql
ALTER TABLE drafts_log ADD COLUMN automatic INTEGER NOT NULL DEFAULT 0;
-- drop and recreate the BEFORE UPDATE trigger of ADR-010 with automatic in its equality list
```

## Done when
`bun test test/drafts/contract/log-triggers.sqlite.test.ts`

## Out of scope
The repository's reads and writes (SPEC-09-3b) and the registration (SPEC-09-3c).

## Open questions
None.
