# TP-01-profile-and-catalog: Testing

Part of [TP-01-profile-and-catalog.md](../tp/TP-01-profile-and-catalog.md). Moved verbatim from there; nothing changed.

## Testing

ATDD (cross-cutting TD-11). Layers: UC = use case through its inbound port with in-memory adapters and a fake clock; C = adapter contract run on the in-memory and the real store; E = end to end over stdio; ARCH = the architecture test. Fixtures: the same five-product catalog in these files: comma with `.` decimals; semicolon with `,` decimals and `1.234,50`; tab with a byte-order mark; Spanish headers in another column order; Arabic headers with Arabic-Indic digits; a sheet range of strings.

| Acceptance test | FR ids | Layer |
|---|---|---|
| Given a profile with seven filled sections, When `get_profile` runs, Then all seven are returned with their text and the guidance code `may_do_is_guidance` | FR-KNOWLEDGE-01-1, FR-KNOWLEDGE-01-2 | UC |
| Given a profile whose headings are in another language and whose `payment` section is empty, When read, Then `payment` is `to_be_confirmed` and the others are `filled` | FR-KNOWLEDGE-01-1 | UC |
| Given a profile line "may offer a 10% discount", When a draft is created and listed, Then it is waiting and the provider fake saw no send | FR-KNOWLEDGE-01-2 | E |
| Given a catalog item with unit, price and availability, When looked up, Then `raw` equals the stored cells and `amount` is the canonical decimal | FR-KNOWLEDGE-01-3 | UC |
| Given the same catalog in all fixture files, When the mapping is confirmed, Then every file returns the same five items and prices | FR-KNOWLEDGE-01-3 | UC, C |
| Given three items (one with an id cell, one with a blank id, two sharing a name), When looked up, Then every item has a non-null `ref` (`id:<cell>`, `n:<folded name>`, `n:<name>#2`), and the refs are unchanged after a price edit; with no id column the confirmation carries `ref_by_name` | FR-KNOWLEDGE-01-3 | UC |
| Given refs of three items and one unknown, When `GetCatalogItems` runs, Then the map holds the three views and `null` for the unknown, the fake sheet counted one read, and an unconfirmed mapping or unreachable catalog gives the same refusal as `find_catalog_items` | FR-KNOWLEDGE-01-3, FR-KNOWLEDGE-01-13 | UC, C |
| Given an item with an empty price, When looked up, Then the price is `to_be_confirmed` (`empty`) and no number is returned; likewise unreadable and `no_currency` | FR-KNOWLEDGE-01-4 | UC |
| Given an item with an empty availability, When looked up, Then it is `to_be_confirmed` | FR-KNOWLEDGE-01-4 | UC |
| Given no item named "flan", When looked up, Then `items` is empty and the note `no_match` is present | FR-KNOWLEDGE-01-5 | UC |
| Given "Tamales de pollo" and "Tamales de cerdo", When "tamales" is looked up, Then both are returned; given two items with the same name, both are returned; given `pollo` and `polvo`, "pollo" returns only `pollo` | FR-KNOWLEDGE-01-5 | UC |
| Given any lookup, Then the result carries `catalog_values_only` and no tool compares draft text with the catalog | FR-KNOWLEDGE-01-6 | UC, ARCH |
| Given a new owner with no files, When `create_templates` runs, Then both files exist with the fields Deputy reads; run again, Then nothing is overwritten | FR-KNOWLEDGE-01-7 | UC |
| Given the owner edits a price in the file and saves, When the next `find_catalog_items` runs in the same process, Then it returns the new price; same for a profile edit | FR-KNOWLEDGE-01-8 | UC, E |
| Given the agent proposes marking tamales unavailable and nothing more happens, Then the catalog file is byte-identical | FR-KNOWLEDGE-01-9 | UC |
| Given a proposal 4, When `apply_change` gets words "yes, 4", Then the catalog shows tamales unavailable, written with the owner's own availability word, and the log holds proposal 4 and the words | FR-KNOWLEDGE-01-9, FR-KNOWLEDGE-01-10 | UC, C |
| Given a profile `must_not_do` change, When applied without words, Then it is refused as a catalog change is | FR-KNOWLEDGE-01-9, FR-KNOWLEDGE-01-10 | UC |
| Given a waiting proposal, When applied with no words, with words without the number, with words equal to a customer message, or with an unknown or closed number, Then each is refused with its code and the catalog is unchanged | FR-KNOWLEDGE-01-10 | UC |
| Given two waiting proposals and the words "ok", Then `words_missing_number` | FR-KNOWLEDGE-01-10 | UC |
| Given the owner saw proposal 4 (price 12) and the agent then proposed price 15 as proposal 5, When 4 is applied with the first go, Then `proposal_superseded`; when 5 is applied with words naming 4, Then `words_missing_number` | FR-KNOWLEDGE-01-11 | UC |
| Given a proposal and an owner who changed the same cell by hand afterward, When applied, Then `target_changed` and the owner's edit is kept | FR-KNOWLEDGE-01-11 | UC, C |
| Given the tool descriptions of `propose_change` and `apply_change`, Then they state that Deputy cannot check who spoke | FR-KNOWLEDGE-01-12 | E |
| Given a spreadsheet catalog that answers `429` or is unreachable, When looked up or applied, Then the refusal is `catalog_unreachable`, no value is returned and nothing is written | FR-KNOWLEDGE-01-13 | UC, C |
| Given a spreadsheet catalog, When looked up twice with a value changed between, Then each lookup reads the sheet (the fake counts two reads) | FR-KNOWLEDGE-01-13 | C |
| Given a draft written at T and a catalog file saved after T, When `CatalogChangedSince(T)` runs, Then `changed` is true; saved before T gives false; a sheet seen for the first time gives false (no baseline yet) | FR-KNOWLEDGE-01-14 | UC, C |
| Given the same, When the agent calls `list_drafts`, Then the MCP adapter shows "catalog changed since this draft" on a reply and on an order draft, using the draft's `madeAt` | FR-KNOWLEDGE-01-14 | E |

More tests that do not map to one FR: seed revision 1 twice writes once (`unchanged`); revision 2 replaces the seeded files; revision 2 after the owner edited the catalog gives `seed_modified` and keeps the edit; revision 1 after 2 gives `revision_stale`; `set_setting catalog_store sheet:<id>` gives `terminal_only` and `file` is accepted; `ApplyCatalogStoreChange` logs the typed command and clears the mapping; the mapping fixtures detect the same roles in all six files with the header text ignored; an ambiguous `1.234` column raises `price_format` and returns no price; a changed header row gives `catalog_mapping_stale`; a per-product currency column overrides the setting; a crash between `applying` and `applied` is reconciled; `value_unsafe` refuses `=1+1`; a CSV with a byte-order mark, CRLF and a quoted newline round-trips unchanged except for the edited cell; a file open in another program (write fails) leaves the file and the proposal intact.
