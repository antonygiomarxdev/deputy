# ADR-010: A change of wording is a new proposal, and a decided draft stays closed

## Status
Accepted (2026-11-25)

## Summary

Changing the wording of a waiting lesson is `propose_lesson` for the same draft: it creates a new proposal with a new number and marks the waiting one `superseded`.

## Context
FR-KNOWLEDGE-02-5b: a confirmation binds to the exact wording shown last; if the wording changes, a new confirmation that holds the new wording is needed. Edge case: a declined lesson is not proposed again for the same draft. From TP-02 TD-4 and the proposal rule of ADR-003.

## Decision
- Changing the wording of a waiting lesson is `propose_lesson` for the same draft: it creates a new proposal with a new number and marks the waiting one `superseded`.
- `keep_lesson` takes the proposal number (an argument, not in the owner's words), the wording shown and the owner's words; it refuses when the wording differs from the stored one (`wording_differs`) or the proposal is superseded.
- A partial unique index on `proposals(draft_number)` for kind `lesson` and status `waiting`, `applying`, `applied` or `declined` allows one live proposal per draft. A declined or kept draft cannot get another (`lesson_already_decided`).
- A lesson takes the number of the proposal that created it, so one number space covers everything the owner can name.

## Options considered
- One proposal with a version counter and a "shown version" mark (the Drafts way): a write on every display, an extra field the agent must send back, and the old words "yes, 4" still name the proposal after a change, which FR-KNOWLEDGE-02-5b forbids.

## Consequences
- Easier: no hash and no version; the old confirmation can never keep the new wording; the log of the new proposal holds what was confirmed.
- Harder: after a change the agent keeps the new proposal, and a plain yes still works only under ADR-017; a lesson the owner declined by mistake cannot be re-proposed from the same draft (the owner can still ask for a catalog or profile change instead).
