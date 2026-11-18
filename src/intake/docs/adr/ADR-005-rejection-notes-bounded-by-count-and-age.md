# ADR-005: Rejection notes are bounded to 500 rows and 30 days, with a counter for what was pruned

## Status
Accepted (2026-11-18)

## Context
FRD-02 open question 1: a flood of forged deliveries could fill storage. Notes hold only a time and a reason (FR-INTAKE-02-2). From the Intake TP-02, TD-3.

## Decision
Keep at most 500 notes and nothing older than 30 days. Why 500: a note is a time and a reason code, about 100 bytes, so 500 rows are about 50 KB, and `rejected_deliveries` returns them in one screenful for the agent; a flood past that shows in the pruned counter, not in more rows. Why 30 days: longer than any gap between an owner's check-ins, and short enough that stale notes do not hide a new problem. A write that goes over the limit deletes the oldest rows in the same transaction and adds their count to `rejection_pruned` (one row: a number and the time of the last prune). `ListRejections` returns the notes and the pruned count.

## Alternatives
- Age only (30 days, no row cap): a flood inside the window still fills the disk one row at a time.
- One row per reason per minute with a count: smallest storage, but a single event cannot be read back and a burst hides its start.

## Consequences
- Easier: bounded disk use; the owner still sees that a flood happened.
- Harder: old notes disappear after 30 days.
- Watch: the numbers 500 and 30 are constants in the domain, not settings.
