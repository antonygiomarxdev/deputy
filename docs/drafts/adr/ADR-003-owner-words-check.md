# ADR-003: Refuse owner words that are copied customer or draft text

## Status
Accepted (2026-11-18)

## Context
FR-DRAFTS-02-6: Deputy refuses an approval whose owner words equal any stored customer message or draft text. FR-DRAFTS-02-3: the words must contain the draft number. From TP-02 TD-1. The cross-cutting TP (TD-6) fixes the whole-token number check.

## Decision
- `OwnerWordsPolicy` (domain) checks, in order: non-empty and at most 1000 characters (a go is one sentence, under 100 characters even when it names three drafts; 1000 is about 150 words, and it stops an agent from pasting a customer thread as owner words); the draft number appears as a whole number token; the normalized words equal no draft text.
- The check against customer text goes through a new Intake inbound port `IsCustomerText({ text })`, which returns `{ matches }`, reached by the Drafts outbound port `CustomerTextCheck`. Intake compares normalized text over all customer messages of every chat.
- Normalization is one function, `normalizeText` in `src/shared/`, defined in the same words in Intake TP-02 and Drafts TP-02: Unicode NFKC; lower case; every `\p{Nd}` digit mapped to its ASCII value (NFKC leaves Arabic-Indic, Persian and Devanagari digits unchanged, so a customer's `٣` would not equal `3`); whitespace collapsed; leading and trailing `\p{P}`, `\p{S}` and whitespace removed (Spanish `¡` `¿`, full-width Chinese punctuation, edge emoji). Drafts and Intake both use it. Tests in es, ar and zh are in Drafts TP-02.
- The number-token rule is the shared function `wholeNumberTokens` in `src/shared/`, next to `normalizeText`, because Knowledge's owner-words check needs the same rule and two copies would drift.
- Number token: a maximal run of digits (after the digit mapping) that is not part of a decimal ("3.5", "3,5", Arabic "٣٫٥"). "3 kilos" still contains token 3 (a typo guard, not authorization; cross-cutting TD-6).

## Alternatives
- Check only the messages of the draft's chat through `ReadChat`: no new Intake port, but text copied from another chat passes.
- Containment instead of equality: far too many false refusals ("1" is inside most messages).

## Consequences
- Easier: one policy for replies, orders and order commands (ADR-005).
- Harder: a customer who writes exactly "go on 3" blocks the owner's identical words. The refusal tells the agent to ask the owner to say it in other words. Intake needs an indexed normalized text column.
