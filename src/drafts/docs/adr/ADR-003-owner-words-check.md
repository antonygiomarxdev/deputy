# ADR-003: Refuse owner words that are copied customer or draft text

## Status
Proposed

## Context
FR-DRAFTS-02-6: Deputy refuses an approval whose owner words equal any stored customer message or draft text. FR-DRAFTS-02-3: the words must contain the draft number. From TP-02 TD-1. The cross-cutting TP (TD-6) fixes the whole-token number check.

## Decision
- `OwnerWordsPolicy` (domain) checks, in order: non-empty and at most 1000 characters; the draft number appears as a whole number token; the normalized words equal no draft text.
- The check against customer text goes through a new Intake inbound port `IsCustomerText({ text })`, which returns `{ matches }`, reached by the Drafts outbound port `CustomerTextCheck`. Intake compares normalized text over all customer messages of every chat.
- Normalization is one function in `src/shared/`: Unicode NFKC, lower case, whitespace collapsed, leading and trailing punctuation removed. Drafts and Intake both use it.
- Number token: a maximal run of digits that is not part of a decimal ("3.5", "3,5"). "3 kilos" still contains token 3 (a typo guard, not authorization; cross-cutting TD-6).

## Alternatives
- Check only the messages of the draft's chat through `ReadChat`: no new Intake port, but text copied from another chat passes.
- Containment instead of equality: far too many false refusals ("1" is inside most messages).

## Consequences
- Easier: one policy for replies, orders and order commands (ADR-005).
- Harder: a customer who writes exactly "go on 3" blocks the owner's identical words. The refusal tells the agent to ask the owner to say it in other words. Intake needs an indexed normalized text column.
