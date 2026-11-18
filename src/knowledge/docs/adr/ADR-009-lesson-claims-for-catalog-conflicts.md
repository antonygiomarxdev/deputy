# ADR-009: A lesson may carry structured claims, and the catalog wins when they differ

## Status
Proposed

## Context
FR-KNOWLEDGE-02-10: lessons are free text, so Deputy does not detect conflicts in them; for each catalog item a lesson links to or names, it returns the catalog value with the marker "catalog wins; lesson differs" when the lesson holds a different price or availability. Owners write in any language and number format. From TP-02 TD-3.

## Decision
- A lesson carries up to 5 claims `{ item, field: 'price' | 'availability', value }`, written by the agent with the proposal and shown to the owner with the wording; the owner confirms both.
- At `list_lessons`, each claim's item is resolved with the `exact` tier of the catalog lookup (ADR-002). A price claim is a plain decimal compared as a decimal string with the parsed catalog amount; an availability claim (`available` or `unavailable`) is compared with the catalog value read through the mapping.
- Result per claim: `same`, `differs` (with the catalog value and the marker `catalog_wins_lesson_differs`), `unresolved` (no item or several), or `catalog_unavailable` (the catalog could not be read; the lessons are still returned).
- Items named in the wording (a folded item name inside the folded wording) are returned with their catalog data and no marker, at most 5 per lesson.
- The catalog is read once per `list_lessons` call.

## Alternatives
- Read numbers out of the wording: "12 pesos for two dozen, 10 for members" holds three numbers with no rule for which is the price, and digits come in other scripts and formats (`١٢`, `1.200,50`); it gives false conflicts and silent misses on a price.
- No detection, the agent compares: breaks FR-KNOWLEDGE-02-10, which makes Deputy return the marker.

## Consequences
- Easier: language-free and exact; the owner sees the claims they confirm.
- Harder: a lesson with no claims is not checked; the tool description says to attach claims. A claim holds a value that can go stale, which is the point of the marker.
