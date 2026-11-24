# ADR-018: Pilot knowledge is four plain files, written whole

## Status
Accepted (2026-11-24)

## Summary
For the pilot, Knowledge keeps profile.md, catalog.md, memory.md and always-ask.md in the folder `knowledge` of the configuration folder. A save replaces a whole file through a temporary file and keeps the last 20 previous versions. From [TP-04](../tp/TP-04-pilot-knowledge-files.md) TD-1 and TD-2.

## Context
REQ-15 and decisions D32, D33 and D38 make setup a conversation in which the owner explains the business, and make knowledge files on the owner's computer. The agent must read them without a shell and write them without a spreadsheet client. The earlier design (TP-01) maps a spreadsheet or a delimited file onto roles, keeps proposals in a database and writes cells; that is more than the pilot needs and holds Google credentials.

## Options considered
- Four plain text files in `<configuration folder>/knowledge`, one tool call reads all, one tool per file writes the whole text. The owner can open and fix them.
- Rows in the database with a tool per field. The owner cannot read or fix them without Deputy.
- One combined file with sections. A bad edit of one section can damage the others, and a size limit applies to all of it.

## Decision
- Four plain text files, in the folder `knowledge` of the configuration folder, and no tool takes a path.
- A save writes the whole new text to a temporary file in the same folder, copies the old file to `knowledge/history/<name>.<time>`, then renames the temporary file over the old one. Only the last 20 history copies of a file are kept.
- Each save appends one line to `knowledge/changes.log`: time, file, the owner's words, a short summary.
- Reads are never cached: each call reads the files as they are.
- Limits approved by the owner on 2026-11-24 (FRD-04 Open questions): 500 catalog items, 20000 characters for the profile and the always-ask list, 500 characters per memory entry, and 20 history copies per file.

## Consequences
- Easier: the owner and the support person read and fix the files with any editor; no proposal state; no credentials of another service.
- Harder: the whole text travels through the agent on each save, so a long catalog costs plan usage; the sizes are capped by the limits above.
- Watch: on Windows a file open in another program can make the rename fail; the save then fails with the old text intact.
