# ADR-012: The round trip is derived from evidence, with only the arrival as the owner's word

## Status
Proposed

## Summary

`CheckRoundTrip` reads evidence on every call: a customer message since the test started (Intake's chat state), a draft for that chat and an `approved` entry with the owner's words, and the newest outcome entry (`held`, `failed`, `unknown` or `sent`) in Drafts' log.

## Context
FR-SETUP-04-4: Setup is complete only when the test message is in the inbox, a draft exists, the owner approved it, the provider accepted the send, and the owner states the reply arrived. FR-SETUP-04-5: the test reply is an ordinary draft. FR-SETUP-04-6: a failure names the part. From Setup TP-04, TD-2.

## Decision
`CheckRoundTrip` reads evidence on every call: a customer message since the test started (Intake's chat state), a draft for that chat and an `approved` entry with the owner's words, and the newest outcome entry (`held`, `failed`, `unknown` or `sent`) in Drafts' log. Only the arrival on the other phone is the owner's word, recorded as a fact after the `sent` entry. The result names the first missing part: `message_not_arrived`, `sent_from_owner_number`, `no_draft`, `not_approved`, `reply_held`, `provider_refused`, `outcome_unknown`, `awaiting_owner_word` or `owner_says_not_arrived`. Setup reads Drafts through `WaitingChats` and `ReadDraftLog` only; it has no port that creates, changes or approves a draft.

## Options considered
- The agent reports each part: a claim is not evidence, and an agent that never asked the owner could fake the proof that the approval path works.
- Setup sends the test reply after the owner says go: a second send path outside `approve_draft`, which D1 forbids.

## Consequences
- Easier: the proof is the real approval path; failures are named.
- Harder: depends on Intake's chat state and Drafts' log shapes.
- Watch: Deputy knows only that the provider accepted the send, so arrival rests on the owner's word.
