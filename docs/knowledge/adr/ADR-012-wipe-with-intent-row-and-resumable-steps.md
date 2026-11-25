# ADR-012: A wipe records its intent first and runs idempotent steps

## Status
Accepted (2026-11-25)

## Summary

Before transaction 1, a complete export is written (ADR-016); if it fails, nothing is deleted.

## Context
FR-KNOWLEDGE-03-5 and FR-KNOWLEDGE-03-9: after a confirmed wipe nothing remains except one entry holding the time and the owner's words. FRD edge cases: a wipe that fails halfway says what remains and never reports success; a second wipe says there is nothing to delete. Files and database rows cannot be changed in one transaction. From TP-03 TD-2.

## Decision
- Before transaction 1, a complete export is written (ADR-016); if it fails, nothing is deleted.
- Transaction 1 inserts a `knowledge_wipes` row (status `running`, time, owner's words) and marks the confirmation applied.
- Then delete the profile file and the catalog file with its backup copy (a sheet is only disconnected: `catalog_store` goes to `file`, nothing is written to the sheet).
- Transaction 2 deletes the rows of `lessons`, `lesson_sources`, `proposals`, `knowledge_log` and `catalog_seen`, clears `catalog_mapping`, sets the log cursor to the newest drafts log entry, and sets the wipe row to `done`, or `partial` when a file step failed. `currency` stays: it is a Setup setting (D21).
- Every step is safe to repeat. A wipe left `running` by a crash is finished by the next `RequestWipe` or `WipeKnowledge` call.
- A failed step returns `wipe_incomplete` with the remaining parts. A new request lists only what remains. A wipe with nothing to delete returns `nothing_to_delete` and writes no entry.
- The cursor moves so that the approvals already in the drafts log are not offered as lessons again after a wipe.
- The wipe changes no other slice: Orders keep their snapshots, Drafts and their log stay (FR-KNOWLEDGE-03-10).

## Options considered
- Delete rows in one transaction, then the files, with no intent row: a crash after the commit leaves the profile and catalog on disk with no record that the owner confirmed, and nothing triggers the rest.
- Move the files to a trash folder first and delete it last: a copy of the profile and catalog stays in the data folder until the last step, which defeats a wipe, and the PRD says wipe deletes.

## Consequences
- Easier: the audit entry exists before anything is deleted; a crash is recoverable; failure is reported honestly.
- Harder: one more table and a reconcile step; a crash leaves data until the next wipe call (the owner is told with `partial`).
