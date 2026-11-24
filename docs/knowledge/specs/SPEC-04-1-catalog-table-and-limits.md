# SPEC-04-1: The catalog table, the size limits and the refusal codes

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The pure rules of the knowledge files: parse a catalog table, count items added, removed and changed, show "to be confirmed" for an empty price or availability, and the size limits. No file access. First of seven runs for FRD-04.

Last change: 2026-11-24, first draft for REQ-15 and D38.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-4 | WHEN | WHEN a catalog item has an empty price or an empty availability, `read_knowledge` shall return "to be confirmed" in its place and shall not fill in a value. |
| FR-KNOWLEDGE-04-9 | IF | IF the catalog text holds no table with the columns name, unit, price and availability, or holds no item, or holds more than 500 items, THEN Deputy shall refuse the save with `catalog_unreadable` and change nothing. |
| FR-KNOWLEDGE-04-10 | IF | IF a profile, an always-ask or a memory text is longer than 20000 characters, THEN Deputy shall refuse the save with `too_large` and change nothing. |
| EX-2 | RULE-1 | boundary | catalog.md lists "Flan" with an empty price | the agent calls `read_knowledge` | the price of "Flan" reads "to be confirmed" and no number appears |
| EX-8 | RULE-3 | positive | this is the owner process | the agent saves a table of 3 items with name, unit, price and availability | catalog.md holds the table and the summary says 3 items added, 0 removed, 0 changed |
| EX-9 | RULE-3 | negative | this is the owner process | the agent saves a table with no price column | Deputy refuses with `catalog_unreadable` and catalog.md is unchanged |
| EX-10 | RULE-3 | boundary | this is the owner process | the agent saves a table of 500 items, then a table of 501 items | the first save is accepted and the second is refused with `catalog_unreadable` |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/knowledge/domain/catalog-table.ts` | Create | parseCatalogTable, renderCatalog, diffCatalog |
| `src/knowledge/domain/limits.ts` | Create | LIMITS, the refusal codes and textSize |

## Reuses
- `src/shared/owner-words.ts` `OWNER_WORDS_MAX`: the owner's words limit is not defined again
- `src/shared/text.ts` `normalizeText`: the header words are matched after it

## Tests first
FR-KNOWLEDGE-04-4, FR-KNOWLEDGE-04-9, FR-KNOWLEDGE-04-10, EX-2, EX-8, EX-9, EX-10, in `test/knowledge/domain`, written without the code in view.

## Build
```ts
export type Refusal = "not_owner" | "owner_words_missing" | "owner_words_size" | "catalog_unreadable" | "too_large" | "not_owner_message" | "text_not_in_message" | "copies_customer_text" | "text_size";
export const LIMITS: { catalogItems: 500; profileChars: 20000; memoryChars: 500; history: 20 };
export type CatalogItem = { name: string; unit: string; price: string; availability: string };
export function parseCatalogTable(text: string): { ok: true; items: CatalogItem[] } | { ok: false; code: "catalog_unreadable" };
export function renderCatalog(items: CatalogItem[]): string; // empty price or availability becomes "to be confirmed"
export function diffCatalog(before: CatalogItem[], after: CatalogItem[]): { added: number; removed: number; changed: number };
export function textSize(text: string, max: number): "too_large" | null;
```
The table has a header row with the columns name, unit, price and availability in any order.

## Done when
`bun test test/knowledge`

## Out of scope
Reading and writing files (SPEC-04-2, SPEC-04-3) and the memory (SPEC-04-4).

## Open questions
None.
