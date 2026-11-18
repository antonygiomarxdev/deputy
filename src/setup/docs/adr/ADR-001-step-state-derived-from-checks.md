# ADR-001: The current step is derived from checks, not stored as a pointer

## Status
Accepted (2026-11-18)

## Context
Setup must show the current step, the remaining count and whose action it is (FR-SETUP-01-1). It must resume by re-checking finished steps (FR-SETUP-01-7), and the check wins over what the agent says (FRD-01 edge cases). From Setup TP-01, TD-1.

## Decision
`SetupProgress` stores per step only facts: started time, passed time, last check result with a fixed reason code. The current step is the first step that is neither passed nor skipped. A resume re-runs the checks of passed steps in order. A failed one goes back to "to do" with its reason, and later passed steps are marked "recheck". Step 6 is never re-run. In test mode steps 2 to 4 are "skipped" and do not count as remaining.

## Alternatives
- A stored `current_step` pointer: it is wrong as soon as the provider disconnects the number or the key is revoked, and resume needs the same checks anyway, so the pointer is a second source of truth.
- State only in the agent conversation: lost when the agent restarts, and two agents would show two states.

## Consequences
- Easier: one source of truth; a broken earlier step is found and named on every resume.
- Harder: each step needs a check that can run alone, and live checks need the provider, so they can fail for reasons outside the owner's control (shown as "retry later").
- Watch: a check that is slow slows `setup_status`; resume runs checks in order and stops at the first failure.
