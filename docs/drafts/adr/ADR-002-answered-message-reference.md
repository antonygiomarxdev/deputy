# ADR-002: A draft keeps a reference to the message it answers, not a copy

## Status
Accepted (2026-11-25)

## Summary

A draft stores `answers_message_id` (the latest customer message when it was made), `basis_message_id` and `basis_sent_at` (the latest message of any source).

## Context
FR-DRAFTS-01-3 shows each waiting draft with the customer message it answers. FR-DRAFTS-01-1 stores the time of the latest chat message at creation, which FRD-03 later uses as a baseline. From TP-01 TD-2.

## Decision
- A draft stores `answers_message_id` (the latest customer message when it was made), `basis_message_id` and `basis_sent_at` (the latest message of any source).
- `ListDrafts` reads the message text through the `ChatReader` port when it builds the view.
- The baseline moves in TP-03 (the checked-through times). The reference stays.

## Options considered
- Copy the customer text into the draft row: a second copy of customer data that Intake can never correct (an edited message, FR-INTAKE-02-12), and it goes stale.
- Store nothing and show the latest customer message at list time: the owner could see a newer question than the one the draft answers.

## Consequences
- Easier: the list shows the current text of that message, including an edit.
- Harder: `ListDrafts` calls Intake once per draft. If Intake cannot return the message, the view says "message not available" and still lists the draft.
