# ADR-002: Catalog lookup folds case and accents and returns exact and contained matches

## Status
Proposed

## Summary

Fold both sides: Unicode NFKC, lower case, then remove combining marks that follow a Latin, Greek, Cyrillic, Arabic or Hebrew letter.

## Context
FR-KNOWLEDGE-01-3 to FR-KNOWLEDGE-01-5: look up by name, say when nothing matches, return all matches. The FRD asks how loose the matching may be. Owners and customers write in any language and script. The answer is a price, so a wrong match is a wrong promise. From TP-01 TD-2.

## Decision
- Fold both sides: Unicode NFKC, lower case, then remove combining marks that follow a Latin, Greek, Cyrillic, Arabic or Hebrew letter. Marks in other scripts are kept (checked in Bun 1.4.4: `Piña` gives `pina`; Arabic and Hebrew marks are removed; Devanagari `कि` is unchanged).
- Tier `exact`: folded names equal. Tier `contains`: every word of the query (split on whitespace and punctuation) is a substring of the folded name. A name without spaces is one word and matches by substring.
- Return both tiers, `exact` first, each marked. No match returns an empty list and the note `no_match`.
- Return at most 20 items (maximum 50 when asked), with `total` and `truncated`. A row is about 40 tokens, so 20 is about 800 tokens; the query `a` on a 300-row catalog would otherwise return about 12,000.

## Options considered
- Fuzzy matching by edit distance (Fuse.js, a Levenshtein package): at distance 1 `pollo` matches `polvo` and `pozo`, so a spelling slip quotes the price of another product; the score threshold also differs by word length and language.
- Exact match of the whole name: `tamales` does not find `Tamales (dozen)`, `Piña` does not find `pina`; the agent says "no item matches" for a product the owner sells.

## Consequences
- Easier: no dependency; plural, accent and case variants are found; every answer lists real items.
- Harder: a short query returns many items and the agent must choose with the owner's help; a misspelling finds nothing and the agent must try another spelling.
