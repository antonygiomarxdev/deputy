# ADR-003: Proposals are immutable and numbered; the owner's words must contain the number

## Status
Proposed

## Summary

A proposal has an integer `number` from one sequence for all kinds.

## Context
FR-KNOWLEDGE-01-10 and FR-KNOWLEDGE-01-11: applying takes the proposal identifier and the owner's words, refuses words that do not identify the proposal ("the Drafts rule"), and the go binds to the old and new values shown. The same mechanism serves lessons (FR-KNOWLEDGE-02-5a) and the wipe (FR-KNOWLEDGE-03-8). From TP-01 TD-3; it follows cross-cutting TD-6 and Drafts ADR-003.

## Decision
- A proposal has an integer `number` from one sequence for all kinds. It never changes after it is stored.
- A new proposal for the same target and field marks the waiting one `superseded`. Applying a superseded number is refused (`proposal_superseded`); the new number needs new words.
- `OwnerWordsPolicy`: words non-empty and at most 1000 characters; the number is a whole token (a maximal digit run after mapping every `\p{Nd}` digit to ASCII, not part of a decimal); the normalized words equal neither the proposal's new text nor any stored customer message (Intake `IsCustomerText`).
- Owner decision D27 relaxes the number rule for lessons only: see ADR-017. Catalog changes and the wipe keep it.
- Applying also checks that the target still holds the old value (`target_changed`).

## Options considered
- The agent passes a hash of the old and new values shown: an agent cannot compute a hash reliably (cross-cutting TD-6).
- The words identify the proposal by its subject (item name or section): it needs a matching rule per language, a lesson has no subject, "no tamales" would count as a go for "tamales", and it adds a second rule beside the Drafts rule.

## Consequences
- Easier: one habit for drafts and proposals; "binds to the values shown" holds by construction; no hash.
- Harder: the owner says a number; the FRD examples without a number are refused. A proposal number can equal a draft number ("go on 4"); accepted for changes as a typo guard (D11), tightened for the wipe (ADR-013).
