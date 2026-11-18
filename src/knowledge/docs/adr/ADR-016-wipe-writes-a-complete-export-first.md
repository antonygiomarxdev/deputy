# ADR-016: A wipe writes a complete export first and refuses if it cannot

## Status
Proposed

## Context
A wipe deletes the owner's own `profile.md` and `catalog.csv`. The confirmation code is shown to the agent, so an injected agent could request and confirm a wipe with invented owner words (D11). FR-KNOWLEDGE-03-7: Deputy suggests an export before a wipe and does not require one of the owner. From TP-03 TD-4.

## Decision
- `WipeKnowledge` runs the export of ADR-011 after the words and the code are accepted and before transaction 1 of ADR-012.
- It proceeds only when the profile, a file catalog, the lessons, the proposals and the log are all `ok` or `absent`. A catalog sheet that cannot be read does not block it, because the wipe never deletes the sheet.
- Otherwise it refuses (`export_write_failed` or `export_incomplete`), and nothing is deleted.
- The result carries the export path and says the export stays and that deleting it is the owner's choice. A wipe cannot be undone inside Deputy; this file is the only way back.

## Alternatives
- Refuse unless the owner exported recently (`export_required`): it makes an export mandatory for the owner, which the FRD says not to, and needs a saved time for the profile and the lessons that Knowledge does not keep.
- No protection beyond the code and the words: authored files are lost for good by a forged confirmation.

## Consequences
- Easier: a wrong or forged wipe is recoverable; the owner does nothing extra.
- Harder: after a wipe a copy of the knowledge remains in the export file; "no knowledge remains" holds for the database and the files only.
