# ADR-012: The catalog is read with papaparse and a confirmed mapping; Google sign-in uses jose

## Status
Proposed

## Context
Deputy serves owners in many countries. Their catalog files differ in separator (`,` or `;` or tab), number format (`1.234,50` or `1,234.50`), header language and column order. D21: Setup suggests the currency from the owner's country and the owner confirms it; a column may override it per product. D22: Deputy detects the separator, the number format and which column is which, and the owner confirms the mapping once. The old code read only comma files with English and Spanish headers (a hand-written parser) and signed Google tokens with a hand-written JWT helper. From TP TD-12.

Checked with Bun 1.4.4 on Windows, from source and from a `bun build --compile` binary:
- `papaparse` 5.7.1 (MIT, published 2026-11-11): a file with a byte-order mark, a quoted `"Queso; fresco"` and a quoted newline parsed to the right cells; `meta.delimiter` was `;`; a tab file gave `\t`.
- `jose` 6.2.17 (MIT, published 2026-11-09, no dependencies): `importPKCS8` and `SignJWT` signed an RS256 JWT with a generated 2048-bit key. Google's service-account flow exchanges such a JWT for a token (https://developers.google.com/identity/protocols/oauth2/service-account).
- `csv-parse` 7.0.3 (MIT, published 2026-09-25) works too, but has no delimiter guessing.

## Decision
- Read the table with `papaparse`. Its delimiter guess (comma, tab, pipe, semicolon, ASCII separators) is step 1 of D22.
- Sign the Google JWT with `jose`.
- No header-alias list in any language. Roles come from the content of each column: name (leftmost mostly distinct text), price (numeric), availability (few distinct values), unit (short repeating text), currency (ISO 4217 codes or symbols), description (long text). The header text is shown next to three sample values so the owner reads the mapping in their language.
- The decimal mark is decided per price column from the last separator of each value: one or two digits after it means a decimal mark; exactly three digits after it is a thousands mark when another value shows the other mark, otherwise ambiguous. The majority of unambiguous values wins. A conflict or an all-ambiguous column becomes a question to the owner. Deputy never guesses a price.
- The owner confirms the mapping once through the proposal flow (`propose_change`, `apply_change`, with the owner's words). It is stored as Knowledge's `catalog_mapping` setting with the header row itself (an equality check, so no hash). A changed header row asks again. Knowledge's and Orders' spreadsheet adapters share one Google client in `src/adapters/google/`. Until confirmed, `find_catalog_items` refuses with the code `catalog_mapping_unconfirmed`.
- Currency: Setup's `currency` setting (suggested from the country, confirmed by the owner); an optional per-product currency column overrides it. A price with neither is "to be confirmed".

## Alternatives
- Keep the hand-written parser and JWT helper: a CSV reader gets quoted separators, newlines, a byte-order mark and delimiter guessing wrong only on real files; and RS256 signing is security code Deputy would own. Rejected.
- `csv-parse` plus our own delimiter guesser: the same kind of maintained parser, but the guessing, the part D22 needs, would be hand-written. Rejected for that reason.
- `google-spreadsheet` with `google-auth-library` (26 installed packages, 27 MB) or `@googleapis/sheets` (45 packages, 14 MB), measured by Orders: far more than one token request needs. Rejected; `jose` is 1 package. All three compile with `bun build --compile`.
- Header aliases in more languages: a list that never ends (an owner's header can be in any language) and silently misreads a file that uses another word. Rejected by D22.
- Let the agent guess the mapping without confirmation: a mistaken or injected guess would put a wrong price in front of a customer. Rejected: the owner confirms once.

## Consequences
- Easier: any country's file works after one confirmation; no alias maintenance; less security code owned.
- Harder: two dependencies; a mapping that must be proposed again when the header row changes.
- Watch: live check at launch of a real Google token request from the compiled binary. Tests: the same catalog in comma, semicolon with comma decimals, tab with a BOM, Spanish-header and Arabic-header files with different column orders all detect the same mapping; an ambiguous column raises a question and returns no price; a changed header asks again; a per-product currency overrides the setting.
