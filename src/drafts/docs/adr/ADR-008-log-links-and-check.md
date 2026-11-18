# ADR-008: Sent entries point to their approval entry

## Status
Accepted (2026-11-18)

## Context
FR-DRAFTS-04-4: every sent entry points to exactly one earlier approval entry, and the text sent equals the text approved. FR-DRAFTS-04-5: the owner can list sent entries that lack one. From TP-04 TD-1.

## Decision
- `drafts_log.approval_entry_id` is written with each `sending`, `sent`, `held`, `failed`, `unknown` and `recorded` entry. It holds the id of the `approved` entry of the approval that started the attempt.
- `CheckApprovals` reports a defect when a `sent` entry: has no pointer; points to an entry that is not an `approved` entry of the same draft; points forward; has a final text different from the approved text; or shares its approval with another `sent` entry.
- `CheckApprovals` also lists gaps: a draft in "sending" or "unknown" with no `sent` entry. A gap is not a defect.

## Alternatives
- Derive the approval at check time from draft number and order: it cannot show "exactly one" when a draft is approved twice, and a missing approval looks the same as a wrong one.

## Consequences
- Easier: the check is one query; Knowledge can follow the pointer too.
- Harder: every writer of those entries must pass the approval entry id. Tests cover each path.
