# ADR-011: The profile and catalog draft waits in Setup until the owner confirms

## Status
Proposed

## Context
FR-SETUP-04-2: Setup hands the profile and catalog to Knowledge only after the owner confirms them, and the owner can change their mind and confirm again. The cross-cutting TP gives Setup one write into Knowledge, `SeedProfileAndCatalog`. From Setup TP-04, TD-1.

## Decision
Setup keeps the owner's answers and catalog items in its own tables as a revisioned draft. One question is asked at a time, in a fixed order of six topics. The whole draft is shown. When the owner confirms a shown revision, Setup sets Knowledge's `currency`, then calls `SeedProfileAndCatalog` with that revision. Knowledge is idempotent per revision and replaces its seeded files with a higher revision only while they are unedited. A change makes revision + 1, shown, confirmed and seeded again. When Knowledge answers `already_exists` or `seed_modified`, Setup keeps what is there and says so; after that, and after Setup completes, changes go through Knowledge's own propose-and-apply flow. Setup asks four profile sections (description, delivery, payment, tone) and takes prices as plain decimals written by the agent; it does not parse locale formats. A small or empty catalog is accepted, and Setup says it can be improved later.

## Alternatives
- Send each answer to Knowledge through its propose-and-apply flow: every answer needs the owner's words, about a dozen calls, and an abandoned run leaves a half-written profile.
- The agent writes the files itself: bypasses Knowledge's ports and log and the owner's confirmation (D9), and does not work with the owner's spreadsheet.

## Consequences
- Easier: one write path into Knowledge, and nothing in Knowledge until the owner agrees.
- Harder: a second copy of the owner's business answers until they are seeded; a seed can be refused when the files were edited since.
- Watch: after the owner or Knowledge edits the files, Setup stops sending revisions.
