# ADR-007: Lesson candidates are found by a log cursor and stored as pointers

## Status
Proposed

## Context
FR-KNOWLEDGE-02-1: Knowledge reads the drafts log and is not told by Drafts. FR-KNOWLEDGE-02-2 and FR-KNOWLEDGE-02-3: an approval (unchanged or corrected) or a rejection can lead to a proposed lesson. The log grows without limit and the owner may not look for days. From TP-02 TD-1.

## Decision
- `knowledge_state.log_cursor` holds the id of the last log entry scanned. Each call reads pages of 100 entries (Drafts' maximum) after the cursor, at most 5 pages. The MCP adapter does the reading and passes `DraftOutcome`s to Knowledge, which keeps the pointers and moves the cursor after each page; Knowledge imports nothing of Drafts, so the slice graph stays acyclic.
- For each reply draft with an `approved` or `rejected` entry that is not scrubbed, `lesson_sources` keeps one pointer: draft number, chat, outcome, entry id, entry time. The first outcome of a draft wins. No text is copied.
- Outcome: `approved_corrected` when the entry's proposed text differs from its final text (exact comparison), else `approved_unchanged`; `rejected` for a rejection. Order drafts are ignored (their entries hold no text).
- A candidate is a pointer with no lesson proposal in status `waiting`, `applying`, `applied` or `declined` for that draft. Texts are read again from the log by entry id when shown.
- Five pages bound one call to about 500 local reads; the cursor continues in the next call.

## Alternatives
- Read the newest 100 entries on every call: 30 drafts at about six entries each is 180 entries a day, so an approval from the morning is out of the window by evening and is lost without a trace.
- Copy the reply texts into Knowledge: a second copy of text with names, prices and addresses that Drafts can never correct and every wipe must find.

## Consequences
- Easier: nothing is missed; no second copy of reply text; a wipe deletes pointers and moves the cursor to the end of the log (TP-03).
- Harder: one table and one state row; the first call on a large log needs several calls to catch up (`more` says so).
