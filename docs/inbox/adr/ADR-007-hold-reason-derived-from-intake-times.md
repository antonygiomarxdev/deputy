# ADR-007: The reason a draft is held is derived from Intake's times

## Status
Proposed

## Summary

For a draft in state `held`, Inbox compares the draft's `writtenAt` with Intake's chat state. An owner answer from the app later than `writtenAt` gives `draft_held_owner_answered`. A customer message later than `writtenAt` gives `draft_held_customer_wrote_again`. Both may apply. With neither it gives `draft_held`.

## Context
FR-INBOX-02-15 asks the summary to show why a draft is held: "you answered from the app" or "the customer wrote again". Drafts' `WaitingChats` returns the state and time of each draft and no reason (Drafts TP-01); that TP is settled. From TP-02 TD-4.

## Decision
- For a draft in state `held`, Inbox compares the draft's `writtenAt` with Intake's chat state. An owner answer from the app later than `writtenAt` gives `draft_held_owner_answered`. A customer message later than `writtenAt` gives `draft_held_customer_wrote_again`. Both may apply. With neither it gives `draft_held`.
- States `failed` and `unknown` give `draft_send_failed` and `draft_outcome_unknown`.

## Options considered
- Drafts adds a hold reason to `WaitingChat`: needs a change to a settled port and one shared code list across two slices.

## Consequences
- Easier: no change to Drafts, no text from Drafts.
- Harder: a hold caused by a failed pre-send catch-up shows the generic `draft_held`.
- Watch: if the lead prefers one reason list in Drafts, only the `DraftsQuery` adapter and `GroupAssigner` change.
