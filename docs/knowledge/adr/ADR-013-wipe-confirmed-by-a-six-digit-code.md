# ADR-013: A wipe is confirmed with a random six-digit code that expires in ten minutes

## Status
Accepted (2026-11-25)

## Summary

`request_wipe` deletes nothing.

## Context
FR-KNOWLEDGE-03-4: Deputy states what will be deleted and deletes nothing until the owner confirms in a way that names the action. FR-KNOWLEDGE-03-8: one way to wipe, taking the owner's words, refusing without them. The owner speaks any language (D20), and draft and proposal numbers are small integers the owner says all day. From TP-03 TD-3 and ADR-003.

## Decision
- `request_wipe` deletes nothing. It returns the plan (profile, catalog, number of lessons, proposals and log entries; whether a sheet stays untouched), the note `safety_export`, a random code from 100000 to 999999 and an expiry 10 minutes later. A new request replaces the waiting one.
- `wipe_knowledge` takes `{ code, owner_words }` and writes the safety export of ADR-016 before it deletes. The words must contain the code as a whole token (the token rule of ADR-003), be non-empty and at most 1000 characters, and not equal any stored customer message. Without words: `words_empty`. Without the code in the words: `words_missing_code`. After the expiry: `wipe_expired`.
- Why six digits: draft and proposal numbers stay far below 100,000, so an ordinary go cannot contain the code. It is not a secret; the agent sees it (D11). Why ten minutes: enough to read the list and export first; short enough that an old request cannot be confirmed by an unrelated message.
- The code comes from a `CodeSource` port (a secure random source in its adapter, a fixed value in tests).

## Options considered
- Use the proposal number: "go on 7" for draft 7 would confirm a waiting wipe 7, and an old request would accept "7" forever.
- Require the word for "wipe" in the owner's words: it needs the word in every language, and "do not wipe" contains it.

## Consequences
- Easier: an accidental confirmation is practically impossible; the confirmation is in the owner's own language around the code.
- Harder: the owner says six digits; a request must be repeated after ten minutes.
