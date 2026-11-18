# ADR-007: Orders checks that the owner's words identify one order

## Status
Accepted (2026-11-18)

## Context
FR-ORDERS-02-4a and FR-ORDERS-02-5: a change or delete is refused when the words do not identify one order. Drafts checks that the words are non-empty and not copied, not that they name the order. From Orders TP-02 TD-1.

## Decision
- Orders matches the words folded with the shared `foldName` (Latin, Arabic and Hebrew marks stripped, Devanagari kept; "Maria" matches "María"; Orders has no fold of its own) against the order id (whole token), the customer name (a token of at least 3 characters, or 2 for Han, Hiragana, Katakana and Hangul) and the chat number (6 or more digits). With several matches only open orders count. It passes only when the match set is exactly the referenced order.
- Otherwise it refuses with `words_do_not_identify_one_order:<ids>`, ids only.
- The words are also refused when they equal an order note or contain a note of 12 or more characters (`words_copied_from_order`).
- The confirming reply of a delete skips the match; the order was identified at the first step.

## Alternatives
- Trust Drafts only: an agent that mixes up customers changes the wrong order unnoticed.
- Require the id in every command: breaks the FRD example "mark Juan's order delivered".

## Consequences
- Easier: a wrong-order change needs the owner's words to name the wrong customer.
- Harder: a nickname is refused and the agent asks. This is a typo guard, not authorization (D11).
