# ADR-006: Availability words and currency symbols are confirmed in the mapping

## Status
Accepted (2026-11-25)

## Summary

The mapping stores `availability: { available: string[]; unavailable: string[] }` and `currencySymbols: Record<string, string>`.

## Context
The availability column holds the owner's own words (`yes`, `sí`, `agotado`, `متوفر`). Orders and the agent need to know whether an item can be ordered, and "mark unavailable" needs the word to write. A currency cell may hold a symbol (`$`) that is `USD`, `MXN` or `USD` depending on the country. D20 forbids per-language catalogs; D22 says detect, show, confirm once. From TP-01 TD-6.

## Decision
- The mapping stores `availability: { available: string[]; unavailable: string[] }` and `currencySymbols: Record<string, string>`.
- Detection lists the distinct values of the availability column with counts and asks (`availability_words`); it suggests no meaning. The owner's answer is part of the confirmation. ISO 4217 codes need no entry. A symbol is a question (`currency_symbol`), unless the `currency` setting is set and the column has one symbol.
- A cell not in the vocabulary reads as "to be confirmed" (`unrecognized`). A change that needs a word the mapping lacks is refused (`availability_word_unknown`); the agent asks the owner and proposes a mapping correction.

## Options considered
- Built-in word lists per language: any language not listed fails silently, and it ships per-language data (D20).
- Return raw text only: Orders cannot tell if an item can be ordered, and "mark unavailable" cannot know what to write.

## Consequences
- Easier: works in any language; one extra answer at the first confirmation.
- Harder: a new word added later is unknown until the owner extends the mapping through a proposal.
