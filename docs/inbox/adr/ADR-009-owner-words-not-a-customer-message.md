# ADR-009: Owner words that equal a customer message are refused

## Status
Proposed

## Summary

`IgnoreChat` requires `ownerWords` (the shared `OwnerWords`) and refuses with `owner_words_copied_from_customer` when Intake's `IsCustomerText` says the normalized words equal a stored customer message.

## Context
FR-INBOX-03-2: ignoring happens only on the owner's explicit command and customer text can never cause it. Deputy cannot verify who spoke (D11), so the owner's words are logged for audit (L4). An injected agent could pass the customer's own sentence as the owner's words. Drafts already refuses approval words that equal a stored customer message. From TP-03 TD-2.

## Decision
- `IgnoreChat` requires `ownerWords` (the shared `OwnerWords`) and refuses with `owner_words_copied_from_customer` when Intake's `IsCustomerText` says the normalized words equal a stored customer message.
- `UnignoreChat` requires the words but skips the copied-text check, because it only makes a chat visible again.
- The check runs through an Inbox outbound port, `CustomerTextCheck`, implemented by an adapter that calls Intake's published port.

## Options considered
- Log the words only: a relayed customer sentence would sit in the log as the owner's.
- A two-step token: the same agent makes both calls, so the second call proves nothing.

## Consequences
- Easier: the cheapest relay attack fails with a clear reason.
- Harder: an owner whose short phrase equals a customer's message is refused once and rewords.
- Watch: a paraphrase passes. The ignored count is in every summary and `list_ignored` shows the words.
