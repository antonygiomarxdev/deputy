# ADR-001: Profile sections are found by marker comments

## Status
Accepted (2026-11-25)

## Summary

Each section starts with a marker line `<!-- deputy:section=<id> -->`.

## Context
Deputy must return "to be confirmed" for an empty profile section (FR-KNOWLEDGE-01-1) and replace one section when a change is applied (FR-KNOWLEDGE-01-9). Owners write the profile in any language, so heading text cannot be matched against a fixed word. From TP-01 TD-1.

## Decision
- Each section starts with a marker line `<!-- deputy:section=<id> -->`. The ids are fixed English codes: `description`, `tone_language`, `may_do`, `must_not_do`, `pickup_delivery`, `payment`, `handoff`. The heading after the marker is free text.
- A section is empty when its body, without HTML comments, heading lines and whitespace, is empty.
- Text before the first marker and any text under no known marker is returned as `other`, so the agent reads the whole file.
- A missing marker is reported as `section_missing`. A change to that section appends a new marked section at the end.
- The template carries the seven markers and one hint comment per section. The `may_do` hint says it guides drafts only (FR-KNOWLEDGE-01-2).

## Options considered
- Match the heading text against fixed English names: an owner who writes `## Formas de pago` has a full section read as empty, and D20 forbids a name list per language.
- Take the position of the Nth level-2 heading: one added heading shifts every later section, so a payment line would be read as delivery and replaced by mistake.

## Consequences
- Easier: any heading language works; a change can never land in the wrong section.
- Harder: an owner can delete a marker; the reader says so instead of guessing.
- Watch: a profile written without markers (not from the template) shows all text as `other` and every section as `section_missing`.
