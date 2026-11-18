# ADR-011: The export is one JSON file in the data folder

## Status
Proposed

## Context
FR-KNOWLEDGE-03-3: one export holds the profile, the catalog and the lessons, in a form the owner can read and keep. The FRD's information also lists the lessons' links and the confirmation log, and an export must not look whole when a part failed. From TP-03 TD-1.

## Decision
- One UTF-8 JSON file `exports/knowledge-<UTC time to the millisecond>.json` in the data folder, written to a temp file and renamed, mode 0600 on POSIX.
- Fields: `format`, `version`, `exportedAt`, `complete`, and one object per part: `profile` (the file text exactly as stored), `catalog` (source, rows of strings, delimiter, confirmed mapping, currency), `lessons` (all fields and claims), `proposals` (every row except wipe requests), `log` (every knowledge log entry).
- Each part has a status: `ok`, `absent` or `failed` with a reason code. `complete` is true only when no part failed. A part that cannot be read (a sheet that is unreachable) does not stop the others; the file is still written with `complete: false`.
- If the file cannot be written, the result is `export_write_failed` and has no path.
- The result gives the path, the time, the counts and the statuses, never the content. The export holds chat ids and the owner's words, no customer message text. A wipe never deletes exports.

## Alternatives
- A folder of originals (`profile.md`, a catalog copy, `lessons.md`, `log.csv`): not one export, a sheet has no file to copy, there is no place to mark "incomplete", and moving one file loses a part.
- Return everything in the tool result: a 5 MB catalog is about 1.2 million tokens in the agent's context, and nothing is kept.

## Consequences
- Easier: one artifact to keep; exact raw text; a partial export cannot pass as whole.
- Harder: JSON is less pleasant than Markdown for a non-technical owner; the agent reads it to them on request. The export is personal data on disk that the owner must protect.
