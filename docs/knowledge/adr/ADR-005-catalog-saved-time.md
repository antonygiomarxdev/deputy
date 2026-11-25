# ADR-005: Catalog saved time is the file's mtime, or a content fingerprint for a sheet

## Status
Proposed

## Summary

File: the modified time of `catalog.csv`.

## Context
FR-KNOWLEDGE-01-14: when the agent lists a waiting draft, Deputy marks it if the catalog was saved after the draft was written. A spreadsheet has no modified time in the Sheets API. From TP-01 TD-5.

## Decision
- File: the modified time of `catalog.csv`.
- Sheet: a SHA-256 of the table text is stored in `catalog_seen` with the time it was first seen to differ. The first observation stores `saved_at = null`, so connecting a sheet marks nothing.
- `CatalogChangedSince({ since })` compares `saved_at` with `since`. In a process that is not the owner it computes without storing.
- An apply sets `saved_at` to its own time.

## Options considered
- Drive API `modifiedTime` for sheets: exact, but the owner must enable a second Google API in the cloud project and the service account needs a second scope (`drive.metadata.readonly`), one more setup step for a non-technical owner.
- The fingerprint for files too: the time of the first read after an edit replaces the exact mtime, giving false marks that the mtime avoids at no cost.

## Consequences
- Easier: no extra Google API; exact for the default file store.
- Harder: a sheet edit is noticed at the next read, so a draft written between the edit and that read can get a mark it does not need. The false mark is the safe direction.
