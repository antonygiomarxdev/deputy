# ADR-007: The owner's choice after a hold is read from the next call

## Status
Accepted (2026-11-18)

## Context
FR-DRAFTS-03-4 offers three choices after a hold: send as is, edit, drop. FR-DRAFTS-03-12 logs the choice. From TP-03 TD-2.

## Decision
- A held draft has `pending_choice = 1`. The next owner action clears it and logs one `owner_choice` entry in the same transaction: `approve_draft` logs "send_as_is", `change_draft` logs "edit", `reject_draft` logs "drop".
- No new tool. Each action keeps its own checks. "Send as is" is an ordinary `approve_draft` with a go that names the draft (FR-DRAFTS-03-5, FR-DRAFTS-03-11).
- After a hold the draft's `shown_version` is cleared, so the agent must call `list_drafts` again before a new go can be recorded.

## Alternatives
- A `choose_after_hold` tool that records the choice and returns the draft to "waiting": one more call that the agent can skip or get wrong, and a second place that must be kept in step with the approval.

## Consequences
- Easier: one flag of extra state; the log still shows the choice.
- Harder: if the owner never answers, the draft stays held and no choice entry exists. That is correct.
