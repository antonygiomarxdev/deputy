# ADR-003: Money is integer minor units, with the exponent of each currency from a port

## Status
Accepted (2026-11-18)

## Context
Deputy computes the order total from prices and quantities (FR-ORDERS-01-15). Currencies have different numbers of decimals (JPY 0, USD 2, BHD 3). The domain imports no package and no platform module (cross-cutting ADR-000). Prices arrive from Knowledge as plain decimal text with a currency code (D21, D22). From Orders TP-01 TD-3.

## Decision
- The domain holds `Money {minor: bigint, currency}` and `Quantity` as an integer number of thousandths. The item price is stored in minor units. A price text is converted with the currency's exponent; a price with more decimals than the exponent allows (12.505 USD) is not stored and the total is "to be confirmed" with `price_precision`.
- A line is `round half up (price_minor x quantity_thousandths / 1000)`; the total is the sum of lines. Each line is what a receipt would show, and the sum equals the shown lines.
- The exponent comes from an outbound port `CurrencyExponent.of(code): number | null`. Its adapter reads `Intl.NumberFormat('en', {style: 'currency', currency}).resolvedOptions().maximumFractionDigits` and returns null for a code outside `Intl.supportedValuesOf('currency')` or one not written as three capital letters (Intl alone gives 2 for an unknown code such as `ZZZ`). Checked in Bun 1.4.4, from source and from `bun build --compile`: JPY 0, USD 2, BHD 3, KWD 3, `ZZZ` not supported.
- The total is known only when every item has a price in one currency; otherwise "to be confirmed" with `price_unknown`, `currency_mixed`, `currency_unknown` or `price_precision`. A total above 10^12 minor units is refused so every value stays a safe integer in storage.

## Alternatives
- Exact decimals with a scale and no currency knowledge: no rounding rule, so a total could show 7 decimals that no currency can pay (1.5 x 3.33 USD = 4.995). Rejected for that failure.
- A money library (for example `dinero.js` or `big.js`): it would have to sit behind a port because the domain imports no package (ADR-000), and Deputy needs only an integer sum and one rounded product. I did not verify a candidate under `bun build --compile`, so none is relied on.
- JavaScript numbers: `0.1 + 0.2` is `0.30000000000000004`, and `1.005 * 100` is `100.49999999999999`.

## Consequences
- Easier: exact, bounded totals in every currency; storage is plain integers.
- Harder: one small port and a rounding rule to state; property tests cover commutativity, round trip, a BigInt reference, and JPY, USD and BHD prices.
