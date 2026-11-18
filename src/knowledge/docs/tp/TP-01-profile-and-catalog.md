# Technical Proposal: Business profile and catalog (Knowledge FRD-01)

Status: Draft

Follows the cross-cutting TP (`docs/tp/TP.md`). "Cross-cutting TD-n" means a decision there. This TP also defines the proposal mechanism that FRD-02 and FRD-03 reuse (TP-02, TP-03).

## Context

Fixed by the cross-cutting TP, so not decided again:

- Knowledge is one bounded context with `domain`, `application`, `ports` and `adapters` (TD-0). The profile and the catalog are owner files behind ports, not aggregates. `Proposal` is an aggregate. Both owner files are read on every call and never cached (FR-KNOWLEDGE-01-8, FR-KNOWLEDGE-01-13).
- Every use case that writes asks `OwnerLease.isOwner()` first and refuses with `not_owner` otherwise. Reads do not ask.
- Catalog import is TD-12 and ADR-012: `papaparse` guesses the delimiter, number format and column roles come from the content of each column and never from header words, the owner confirms the mapping once through the proposal flow, the mapping is the `catalog_mapping` setting, and until it is confirmed `find_catalog_items` refuses with `catalog_mapping_unconfirmed`. Currency follows D21: the `currency` setting, optionally overridden by a per-product column. A price with neither is "to be confirmed". This TP only adds the exact algorithm and the points that ADR-012 leaves open.
- Libraries stay behind ports (cross-cutting ADR-000). `papaparse` is named only in `src/knowledge/adapters/files/`; `jose` and every HTTP call only in the shared Google client `src/adapters/google/` (Orders ADR-013: one token path and one request budget for the catalog sheet and the orders sheet). Knowledge's `src/knowledge/adapters/sheets/` is a thin `CatalogStore` over that client and imports neither `jose` nor `fetch`. Knowledge needs one endpoint beyond the five Orders lists: `values:batchUpdate` with `USER_ENTERED` for a single-cell update (the `updateCells` request writes strings literally and would not parse `15,50` as a number); agreed with tp-orders. The domain gets a `RawTable` (rows of strings) and never a library type.
- Language (D20): every refusal and status is a fixed code with an English default text. No catalog or profile value is ever part of a code.
- The spreadsheet catalog is read through the Google Sheets API. The default read quota is 300 requests per minute per project and 60 per minute per user; beyond it the API answers `429` (https://developers.google.com/workspace/sheets/api/limits, read 2026-11-17). With a spreadsheet, each lookup is one read (FR-KNOWLEDGE-01-13), so a burst of lookups can hit the user quota. The adapter reports `429` as `catalog_unreachable` with reason `rate_limited`, which satisfies "fails with a clear message and nothing is changed".
- Facts checked in Bun 1.4.4 on Windows 11 for this TP: `papaparse` 5.7.1 reports `meta.delimiter` and `meta.linebreak`; `Papa.unparse(rows, { delimiter, newline })` writes the same delimiter and line break back; it drops quotes that are not needed (`"1.234,5"` in a `;` file becomes `1.234,5`, same cell value); a byte-order mark is read as part of the first cell and must be kept by hand; the trailing line break is not written back and must be kept by hand; in non-streaming mode `meta.cursor` equals the input length, so it gives no per-row offset; `fs.renameSync` of a temp file over an existing file works. Google's `valueInputOption=USER_ENTERED` parses values "as if the user typed them into the UI" and `RAW` stores them as-is (https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueInputOption). `valueRenderOption=FORMATTED_VALUE` returns values formatted by the cell and the spreadsheet's locale (https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueRenderOption).

Consequences settled here without a choice:

- **One table shape.** Both stores hand the domain a `RawTable { cells: string[][]; delimiter: string | null; modifiedAt: string | null }`. A spreadsheet is read as formatted strings, so the detector, the parser and the writer are the same code for both. Numbers in a spreadsheet come back as the owner sees them (`1.234,50`), which is what the mapping describes.
- **Business folder.** The file adapters get the folder from the composition root (default `business/` in the data folder). No tool input is a path.
- **Templates.** Text of the profile template and the catalog template is a constant in `src/knowledge/domain/templates.ts`, so it is also in the compiled binary. `create_templates` writes a file only when it does not exist; it never overwrites.
- **Size limits.** A catalog file larger than 5 MB, or a sheet range larger than 5000 rows by 26 columns (A to Z), is refused with `catalog_too_large`. Why: a small business catalog is tens to a few hundred rows; 5 MB is thousands of times more, and the file is read on every lookup; 5000 by 26 is 130,000 cells, about 1 to 2 MB of JSON in one request.
- **Owner words limit.** Owner words are at most 1000 characters, for the same reason as Drafts ADR-003.

## Requirements served

FR-KNOWLEDGE-01-1, FR-KNOWLEDGE-01-2, FR-KNOWLEDGE-01-3, FR-KNOWLEDGE-01-4, FR-KNOWLEDGE-01-5, FR-KNOWLEDGE-01-6, FR-KNOWLEDGE-01-7, FR-KNOWLEDGE-01-8, FR-KNOWLEDGE-01-9, FR-KNOWLEDGE-01-10, FR-KNOWLEDGE-01-11, FR-KNOWLEDGE-01-12, FR-KNOWLEDGE-01-13, FR-KNOWLEDGE-01-14. Related: FR-SETUP-04-2 (the seed), FR-ORDERS-01-2 and FR-ORDERS-01-14 (Orders reads the catalog and keeps a snapshot), FR-DRAFTS-02-6 (the owner-words rule that the apply rule copies).

## Decisions

### TD-1: How does Deputy find the sections of the profile?

The profile is a Markdown file the owner edits. Deputy must return "to be confirmed" for an empty section (FR-KNOWLEDGE-01-1, edge case "required field is empty") and must replace one section when a change is applied (FR-KNOWLEDGE-01-9). Owners write in any language, so the heading text cannot be assumed.

- **Option A** A marker comment before each section, `<!-- deputy:section=payment -->`, with a fixed English id (`description`, `tone_language`, `may_do`, `must_not_do`, `pickup_delivery`, `payment`, `handoff`). The heading text after it is free. Cost: the template carries seven marker lines, and an owner can delete one. Risk: a deleted marker. The reader then reports `section_missing` for that id, still returns all text of the file, and a change to that section appends a new marked section at the end.
- **Option B** Match the heading text against fixed English names (`## Payment`). Cost: none in the file. Risk: an owner who writes `## Formas de pago` has a full section reported as empty, and a change to "payment" cannot find its target. D20 forbids a list of names per language.
- **Option C** Take the position of the Nth level-2 heading. Cost: none. Risk: an owner who adds one heading shifts every later section, so a payment line is read as delivery, and Deputy would then replace the wrong text on a change.

Chosen: Option A, because it is the only one that works for any heading language and cannot silently map text to the wrong section. A marker is an HTML comment, so it does not show in a Markdown viewer. Recorded in ADR-001.

### TD-2: How is a catalog item found by name?

FR-KNOWLEDGE-01-3 to FR-KNOWLEDGE-01-5: look up by name; no match says so; several matches are all returned. The FRD asks which matching is acceptable. Owners write names in any language and script.

- **Option A** Fold both sides, then two tiers. Folding: Unicode NFKC, lower case, and removal of combining marks that follow a Latin, Greek, Cyrillic, Arabic or Hebrew letter (checked: `Piña` gives `pina`; Arabic harakat and Hebrew niqqud are removed; the Devanagari `कि` is kept, because in those scripts a mark changes the word). Tier `exact`: folded names are equal. Tier `contains`: every word of the query (split on whitespace and punctuation) is a substring of the folded name; a name written without spaces, such as Chinese, is one word and matches by substring. Both tiers are returned, `exact` first, each marked. Cost: a small pure function, no dependency. Risk: a short query matches many items (`pan` matches `panela`); mitigated by returning every match, never a pick, and by a cap with the total.
- **Option B** Fuzzy matching by edit distance with a library (for example Fuse.js or a Levenshtein package). Cost: a dependency and a threshold. Risk: the answer is a price. With distance 1, `pollo` (chicken) matches `polvo` (octopus) and `pozo`; a wrong match quotes the wrong price. Fuzzy ranking also needs a score threshold that differs by language and word length.
- **Option C** Exact match on the whole trimmed name only. Cost: least code. Risk: `tamales` does not find `Tamales (dozen)` or `Tamales de pollo`, so the agent says "no item matches" for a product the owner sells, and `Piña` does not find `pina`.

Chosen: Option A. It finds the plural and accent variants owners and customers actually write, never invents a match the way edit distance does, and costs no dependency. Spelling mistakes are left to the agent, which can look up again with another spelling; the answer then always lists real items. At most 20 items are returned (default and maximum 50 when asked): a row is about 40 tokens, so 20 rows is about 800 tokens and a query like `a` on a 300-row catalog would otherwise return about 12,000. The result always carries `total` and `truncated`. Recorded in ADR-002.

### TD-3: How does the owner's go identify one proposal and bind to its values?

FR-KNOWLEDGE-01-10 and FR-KNOWLEDGE-01-11: apply takes the proposal identifier and the owner's words, refuses words that do not identify the proposal ("the Drafts rule for a go"), and the go binds to the old and new values shown. Edge case: with two proposals waiting, "ok" is not a go. The same mechanism serves lessons (TP-02) and the wipe (TP-03).

- **Option A** Proposals are immutable and numbered. The number is a plain integer shown as "Proposal 4". The owner's words must contain the number as a whole token, using the same rule as Drafts (a maximal run of digits after mapping every `\p{Nd}` digit to ASCII, not part of a decimal). A change is a new proposal with a new number; a waiting proposal for the same target and field is marked `superseded`. Applying the old number is refused with `proposal_superseded`, and the new number needs new words. The words must not equal a stored customer message (Intake `IsCustomerText`) and must not equal the proposal's own new text. Cost: the owner says a number. Risk: a number shared with Drafts ("go on 3") can name a proposal 3; accepted for changes (a typo guard, not authorization; cross-cutting TD-6 and D11) and tightened for the wipe (TP-03).
- **Option B** The agent passes a hash of the old and new values it showed. Cost: binds exactly. Risk: an agent cannot compute a hash reliably (cross-cutting TD-6 chose to pass the text shown for this reason).
- **Option C** Words identify the proposal by its subject (the item name or the profile section) when exactly one waiting proposal matches. Cost: the owner can answer in natural words, like the FRD example "Yes, mark the tamales unavailable". Risk: it needs a match rule per language; lesson wording is free text and has no subject; "no tamales" contains the subject and would count as a go; and it adds a second rule beside the Drafts rule that the FRD says to follow.

Chosen: Option A. It is the Drafts rule, so one owner habit covers drafts and proposals, and an immutable proposal makes "the go binds to the values shown" true by construction, with no hash. The FRD example has no number; under this rule the agent shows "Proposal 4" and the owner answers "yes, 4" (see Open questions). Recorded in ADR-003.

### TD-4: How is a confirmed change written to the owner's file or spreadsheet?

An apply must change one cell (or add one row) in a catalog the owner also edits by hand, or one section of the profile, and must never lose the owner's other content.

- **Option A** Cell operations with a row check done by the store adapter. The domain locates the row and produces `CellOp`s, each carrying the whole row as it was read. The adapter re-reads, checks that the row still equals it, and writes. File store: parse, change the cell, `unparse` with the same delimiter and line break, keep the byte-order mark and the final line break, check that parsing the output gives the expected table, write a temp file in the same folder, copy the old file to `catalog.csv.deputy-bak` (one copy, overwritten each time), rename the temp over the file. Sheet store: re-read the row, compare, then `values.update` of that one cell with `USER_ENTERED`. Cost: two row reads on a sheet and a small adapter per store. Risk: a change by the owner between the re-read and the write (a few milliseconds) is accepted.
- **Option B** Replace the whole table with the new one. Cost: simplest. Risk: on a sheet it overwrites formulas, number formats and other columns the owner keeps; on a file it overwrites an edit the owner saved while the change waited for the go (which can be days).
- **Option C** Patch the file text in place at the byte offset of the row. Cost: keeps every other byte. Risk: papaparse gives no per-row offset (checked: `meta.cursor` is the input length), so Deputy would need its own CSV scanner, which is the hand-written parser that cross-cutting TD-12 rejects.

Chosen: Option A. It is the only option that neither overwrites a hand edit nor needs a parser of its own. Order of effects (log first, then write, as in cross-cutting TD-6): one transaction marks the proposal `applying` and appends `apply_requested` with the owner's words; then the store writes; then one transaction marks it `applied` and appends `applied`, or marks it `waiting` again and appends `apply_failed` with the reason code. A proposal left `applying` by a crash is reconciled at the start of the next `ProposeChange`, `ApplyChange` or `ListProposals` run (owner process only): if the target now holds the new value it becomes `applied`, otherwise `waiting`. Values written are checked first: a text value that starts with `=`, `+`, `-` or `@`, or contains a tab or a carriage return, is refused with `value_unsafe`, because `USER_ENTERED` treats typed text as the UI would, which includes a leading `=` becoming a formula, and Excel does the same for a CSV opened by the owner. A price is accepted only as a plain decimal (`15.50`), is written with the mapping's decimal mark, and is read back through the same parser; it must give the same number or the proposal is refused with `value_invalid`. Recorded in ADR-004.

### TD-5: How does Deputy know when the catalog was last saved?

FR-KNOWLEDGE-01-14: when the agent lists a waiting draft, Deputy marks it if the catalog was saved after the draft was written.

- **Option A** Ask the storage for its modified time: the file's mtime, and for a spreadsheet the Drive API `modifiedTime`. Cost: exact for both. Risk: the Drive API is a second Google API the owner must enable in the same cloud project and a second scope (`drive.metadata.readonly`) on the service account, an extra setup step for a non-technical owner.
- **Option B** File: mtime. Spreadsheet: a fingerprint (SHA-256 of the table text) kept in `catalog_seen` with the time it was first seen to change. Cost: one hash per read and one row. Risk: a spreadsheet edit is noticed only when Deputy next reads, so the saved time is the time of that read, which can be later than the edit; a draft written between the edit and the read could get a mark it does not need. The first observation sets no time (`saved_at` is null), so connecting a sheet marks nothing.
- **Option C** The fingerprint for both stores. Cost: one code path. Risk: for a file, the time of the first read after the edit replaces the exact mtime, with the same false marks.

Chosen: Option B. The mtime is exact and free for files, which is the default; a false mark is the safe direction (the owner re-checks a price); and no second Google API is needed. `CatalogChangedSince({ since })` returns `{ changed, savedAt }` and stores the observation when the process is the owner. Recorded in ADR-005.

### TD-6: How does Deputy know which words mean "available" and which symbols mean which currency?

The availability column holds the owner's words (`yes`, `sí`, `agotado`, `1`, `متوفر`). Orders and the agent need to know whether an item can be ordered, and a change "mark unavailable" needs the word to write. A currency cell can hold a code (`NIO`) or a symbol (`$`, which is also `USD`, `MXN`, `COP`).

- **Option A** The mapping holds the vocabulary. Detection lists the distinct values of the availability column with counts and suggests none as meaning yes or no unless the column has exactly two distinct values; the owner marks each value `available` or `unavailable` when confirming the mapping, once. A symbol in a currency column is resolved the same way (`{ "$": "NIO" }`), and ISO 4217 codes need no entry. Cost: one extra answer at confirmation. Risk: a new word added later (`pronto`) is unknown; the item then shows availability "to be confirmed" with reason `unrecognized` until the owner extends the mapping through a new proposal.
- **Option B** Built-in word lists per language. Cost: none for the owner. Risk: any language not listed fails silently, `no` is a word in Spanish and Portuguese but `não` and `nein` are not in an English list, and D20 forbids shipping per-language catalogs.
- **Option C** Do not interpret: return the raw text only. Cost: no vocabulary. Risk: Orders cannot tell whether an item can be ordered, the change "mark unavailable" cannot know what to write, and every agent must guess.

Chosen: Option A. It is the same idea as D22 (detect, show, confirm once) and works in any language. When the mapping has no word for a state, the change is refused with `availability_word_unknown` and the agent asks the owner, then proposes a mapping correction. Recorded in ADR-006.

### TD-7: What is the stable reference of a catalog item?

Orders stores a reference and a snapshot, and later re-reads the item by that reference (`GetCatalogItems`). The owner's file has no key Deputy controls.

- **Option A** The owner's id column when the mapping has one (`id:<cell>`), otherwise the folded name (`n:<folded name>`, the folding of TD-2). A repeated reference (two blank or equal ids, two rows with one name) gets the suffix `#2`, `#3` in file order. Cost: no state. Risk: without an id column, renaming a product changes its reference, and reordering rows that share a name swaps their suffixes. The mapping confirmation says so (question code `ref_by_name`, shown only when no column has the role `id`), so the owner can add an id column.
- **Option B** The row number. Cost: simplest. Risk: sorting the file or deleting a row changes every reference below it, and an order then points at the wrong product.
- **Option C** A reference Deputy writes into a hidden column or its own table. Cost: survives renames. Risk: it writes into the owner's file or sheet unasked, and a row the owner copies carries a duplicate reference.

Chosen: Option A. It is never null, needs no write, and is stable across price, unit and availability edits; the one case that changes it (a rename without an id column) is told to the owner at confirmation. Recorded in ADR-014.

### TD-8: Who adds the "catalog changed since this draft" mark to a listed draft?

FR-KNOWLEDGE-01-14. Knowledge already depends on Drafts (it reads the drafts log, FR-KNOWLEDGE-02-1), so Drafts must not depend on Knowledge.

- **Option A** Drafts' `ListDrafts` calls Knowledge through a Drafts outbound port. Cost: one call site. Risk: a cycle between two slices; the architecture test of TP-02 (no Drafts use case has a port to Knowledge) would fail.
- **Option B** The MCP adapter, which already maps tools to use cases of several slices, calls `ListDrafts` and then `CatalogChangedSince` for each draft's `madeAt` and merges the mark into the tool result. Cost: a few lines in the adapter and one catalog fingerprint read per list (a file mtime, or one sheet read). Risk: logic in an adapter; it is only a flag merge.
- **Option C** Only order drafts get the mark, from Orders' `revalidate`. Cost: no new call. Risk: reply drafts quote prices too, so a stale price in a reply goes unmarked, which FR-KNOWLEDGE-01-14 covers ("a waiting draft").

Chosen: Option B. It keeps the dependency one way, covers both draft kinds, and costs one read per listing, not per draft (the fingerprint is read once and compared with each `madeAt`). `CatalogChangedSince` takes an array of times in the adapter's single call. Recorded in ADR-015.

## Architecture

```mermaid
flowchart LR
  Agent["Agent"] --> MCP["MCP adapter"]
  MCP --> Inb(["Inbound ports: GetProfile, FindCatalogItems, GetCatalogItems, CreateTemplates, ProposeChange, ApplyChange, DeclineProposal, ListProposals, CatalogChangedSince, SeedProfileAndCatalog, SetKnowledgeSettings, ApplyCatalogStoreChange"])
  Setup["Setup adapter"] --> Inb
  Ord["Orders adapter: CatalogLookup"] --> Inb
  Mcp2["MCP adapter, list_drafts: adds the catalog mark"] --> Inb
  Inb --> App["application: one use case per file"]
  App --> Dom["domain: Profile, CatalogMapping, MappingDetector, Catalog, CatalogMatcher, CatalogChange, Proposal, OwnerWordsPolicy"]
  App --> Out(["Outbound ports"])
  Out --> PS["ProfileStore: file adapter"]
  Out --> CS["CatalogStore: CSV file adapter with papaparse, or Google Sheets adapter with jose"]
  Out --> Repo["ProposalRepository, KnowledgeLog, KnowledgeSettings, CatalogSeenRepository: SQLite"]
  Out --> Cust["CustomerTextCheck: calls Intake IsCustomerText"]
  Out --> Sys["Clock, OwnerLease, Digest, GoogleCredentials"]
```

Domain (`src/knowledge/domain/`, no I/O, no package):

- `Profile` (value object): parsed from the file text. `sections` (each `{ id, heading, body, state: 'filled' | 'to_be_confirmed' }`), `preamble`, `missing: SectionId[]`. `withSection(id, text)` returns the new file text. A section is empty when its body, after removing HTML comments, heading lines (`^#{1,6} .*$`) and whitespace, is empty. Comments are removed from the text returned to the agent, not from the file.
- `RawTable` and `CatalogMapping` (value objects, below). `CatalogMapping` fields: `version: 1`, `source: 'file' | 'sheet'`, `delimiter: string | null`, `hasHeader: boolean`, `headerRow: string[]` (the header cells themselves, not a hash, so the stale check is an equality), `decimal: '.' | ',' | '٫' | null`, `thousands: string | null`, `columns: { index: number; role: Role; headerText: string }[]` with `Role = 'id' | 'name' | 'unit' | 'price' | 'currency' | 'availability' | 'notes' | 'ignore'`, `availability: { available: string[]; unavailable: string[] }`, `currencySymbols: Record<string, string>`.
- `MappingDetector` (domain service, pure): `detect(table, corrections?) -> { mapping, questions, samples }`. Algorithm below.
- `Catalog` (value object): `Catalog.read(table, mapping, currency) -> CatalogItem[]`. `CatalogItem { row: number; ref: string; name: string; unit: Field; price: PriceField; availability: AvailabilityField; notes: string | null; rowCells: string[] }`.
- `CatalogMatcher` (pure): `fold(text)`, `match(items, query) -> { item, tier }[]`.
- `CatalogChange` (pure): builds `CellOp[]` from a proposal and a `Catalog`; checks values (`value_unsafe`, `value_invalid`).
- `Proposal` (aggregate). Fields: `number`, `kind`, `status`, `target`, `oldValue`, `newValue`, `detail`, `createdAt`, `decidedAt`, `expiresAt`, `supersededBy`. States: `waiting` to `applying` to `applied`; `waiting` to `declined`, `superseded` or `expired`; `applying` back to `waiting` on failure. Invariants: a closed proposal never reopens; `apply` needs words that pass `OwnerWordsPolicy`.
- `OwnerWordsPolicy` (pure): non-empty and at most 1000 characters after trimming; the proposal number is a whole token (rule in TD-3); `normalizeText(words)` equals neither the proposal's `newValue` nor, through the `CustomerTextCheck` port called by the use case, any stored customer message. The whole-token function is copied from Drafts' domain with the same tests until the lead moves it into `src/shared/` (see Open questions).
- Events: `ChangeApplied { proposal, target, at }` and `ChangeApplyFailed { proposal, reason, at }`. No slice subscribes in v1; Knowledge's own log is written from them.

### Mapping detection (the part ADR-012 leaves to this TP)

Input: a `RawTable` with the delimiter guess. Output: a suggested `CatalogMapping` and a list of questions. It is a suggestion; the owner confirms it (D22). The header text is never read for meaning; it is shown next to three sample values per column.

1. Header row. The first row is the header unless some column parses as a number in every other row and also in the first row (then `hasHeader = false`). A one-row file has a header and no items (`catalog_empty`).
2. Per column, over non-blank data cells: `n`, distinct ratio `d`, numeric ratio `r` (share that parses under step 3), mean length, maximum length.
3. Number format of each numeric column (TD-12, step 2, made exact). Strip `\p{Sc}`, letters and whitespace (including U+00A0, U+202F, U+2009); map every `\p{Nd}` digit to ASCII; keep digits and the separators `.` `,` `٫` `٬` `'` and space. Each value votes by its last separator and the digits after it: 1, 2 or 4 or more digits mean decimal mark (`12,50`, `1.234,5`, `1,234.50`, `٣٫٥٠`, `0.0015`); exactly 3 digits mean thousands mark when the value has two different separators or the same separator repeated with every later group 3 digits long (`1.234.567`); a lone separator followed by exactly 3 digits is ambiguous (`1.234`); a space or apostrophe as last separator is a thousands mark; anything else (`12.5.5`, `abc`) is unreadable. Two different separators in one value fix both marks (`1.234,50` gives decimal `,` and thousands `.`). The column's format is the majority of the unambiguous votes. If the unambiguous votes disagree (some `12,50`, some `12.50`) or none exist and an ambiguous value is present, the detector adds a question (`price_format`: "does 1.234 mean 1234 or 1.234?") with the values, and returns no decimal mark. The mapping cannot be applied while a question is open (`mapping_has_questions`). Checked on a prototype in Bun for: `12,50`, `1.234,5`, `1,234.50`, `$ 12.50`, `1 234,50`, `1.234`, `1,234`, `12`, `٣٫٥٠`, `1,23,456.00`, `1.234.567`, `CHF 1'234.50`, `12.5.5`, `abc` and the empty string; the last two are unreadable.
4. Roles, in this order, each column taking the first role it satisfies, one column per role except `ignore` and `notes`:
   - `price`: `r >= 0.8`. If several columns qualify, the one with the highest share of values that have a decimal part wins; the others stay `ignore` and are shown to the owner. A numeric column that is sorted ascending with step 1 is `id`.
   - `currency`: every non-blank cell is an ISO 4217 code (a constant list in the domain, about 180 codes) or is one to three characters of `\p{Sc}`.
   - `availability`: at most 4 distinct values and at least 2 rows.
   - `id`: not numeric, distinct ratio 1, maximum length 24.
   - `name`: among the remaining text columns, the leftmost with `d >= 0.8`.
   - `unit`: text, maximum length 24, `d <= 0.6`.
   - `notes`: text with mean length at least 30.
   - everything else: `ignore`.
   Why these numbers: they only decide the first suggestion; the owner sees all columns with samples and corrects any. They are fixed by the fixture tests (Testing), not tuned elsewhere.
5. Availability vocabulary: the distinct values of the availability column with counts. If there are exactly two, no suggestion is made about which is which (a language-free rule cannot know); both go in a question `availability_words`. The owner's answer lists the available words and the unavailable words.
6. Currency symbols: the distinct symbols of the currency column that are not ISO codes, each in a question `currency_symbol`, unless the owner's `currency` setting is set and the column has a single symbol (then the symbol maps to that currency, shown for confirmation).
6b. No `id` role: when no column has the role `id`, the detector adds the notice question `ref_by_name`: item references then come from the folded name (TD-7), so renaming a product changes its reference. The owner sees it at confirmation and may add an id column.
7. `corrections` (from the agent, after the owner answered): `{ delimiter?, hasHeader?, decimal?, thousands?, roles?: { index, role }[], availability?, currencySymbols? }` override the suggestion; detection is re-run with them and the questions they answer are closed.

### Reading and lookup

`FindCatalogItems` runs these steps in order: the `catalog_store` setting; `CatalogStore.read` with the confirmed delimiter; mapping check; `Catalog.read`; match; cap. Rows with a blank name are ignored. A row shorter than the mapping is padded with blanks (so its missing cells are "to be confirmed"). A price cell is `to_be_confirmed` when empty (`empty`), when it does not parse under the mapping (`unreadable`), or when no currency is known for the row (`no_currency`); in none of these cases is a number returned. The raw cell is returned with every value (`raw`) so the agent sees exactly what the owner stored; the parsed `amount` is a canonical decimal string (`"12.50"`), never a float.

### Apply

`ProposeChange` validates and stores; `ApplyChange` checks words and state, then runs TD-4. For a catalog change the domain re-locates the row: the proposal stores the row's cells as shown (`rowCells`). At apply the current table is searched for rows equal to `rowCells`: none gives `target_changed`; more than one gives `row_ambiguous` (two identical rows; the owner fixes the file); exactly one gives the `CellOp`. For a profile change, the current section body must equal the proposal's `oldValue` or the apply gives `target_changed`.

## Information

SQLite, init migration of this slice (the lead places it in the numbered migration files). `proposals` is shared by TP-02 (lessons) and TP-03 (wipe); only `kind = 'change'` is used here.

```sql
CREATE TABLE proposals (
  number        INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL CHECK (kind IN ('change','lesson','wipe')),
  status        TEXT NOT NULL CHECK (status IN ('waiting','applying','applied','declined','superseded','expired')),
  target_key    TEXT NOT NULL,             -- 'profile:payment', 'catalog:Tamales (dozen)|price', 'mapping', 'lesson:<draft>', 'wipe'
  target        TEXT NOT NULL,             -- JSON, see below
  old_value     TEXT,
  new_value     TEXT,
  detail        TEXT NOT NULL DEFAULT '{}',-- JSON: row cells shown, questions, lesson fields (TP-02)
  code          INTEGER,                   -- wipe confirmation code (TP-03)
  draft_number  INTEGER,                   -- lesson source (TP-02)
  created_at    TEXT NOT NULL,
  decided_at    TEXT,
  expires_at    TEXT,                      -- wipe only
  superseded_by INTEGER REFERENCES proposals(number)
);
CREATE INDEX proposals_waiting ON proposals (kind, status, target_key);

CREATE TABLE knowledge_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN
    ('apply_requested','applied','apply_failed','declined','seed','setting','lesson_kept','lesson_edited','lesson_deleted')),
  proposal    INTEGER REFERENCES proposals(number),
  owner_words TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT ''     -- reason code, or old and new wording for lessons
);

CREATE TABLE catalog_seen (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  fingerprint TEXT NOT NULL,               -- SHA-256 of the table text (sheet) or of the file text
  saved_at    TEXT,                        -- null until a change is seen
  seen_at     TEXT NOT NULL
);
```

`target` JSON: `{"kind":"profile_section","section":"payment"}`, `{"kind":"catalog_set","item":"Tamales (dozen)","field":"availability"}`, `{"kind":"catalog_add"}`, `{"kind":"catalog_mapping"}`. `target_key` for a catalog set is `catalog:` plus the item name, a `|`, and the field, so a second proposal for the same item and field finds the first and supersedes it. `detail` for a catalog set holds `rowCells`.

Settings (the shared `settings` table, Knowledge keys, cross-cutting TD-8): `catalog_store` (`file` or `sheet:<spreadsheetId>`; the tab is always `Catalog`), `currency` (an ISO 4217 code), `catalog_mapping` (the `CatalogMapping` JSON). Changing `catalog_store` clears `catalog_mapping` in the same step, so the new source needs a new confirmation.

Owner files: `profile.md` (template below) and `catalog.csv` in the business folder. Catalog template (header only, the fields Deputy reads): `id,name,unit,price,available,notes`. Profile template: seven marked sections with a hint comment each; the `may_do` hint states that it guides drafts only and that nothing goes out without the owner's go (FR-KNOWLEDGE-01-2). The seed writes the catalog in this canonical shape (comma, `.` decimal, `yes` and `no`) and stores the matching mapping as confirmed, because Deputy wrote the file itself.

## Interfaces

Inbound ports (published in `src/knowledge/index.ts`). Every result is a union with `ok: false` carrying `code` and the English default `text`.

```ts
type SectionId = 'description' | 'tone_language' | 'may_do' | 'must_not_do' | 'pickup_delivery' | 'payment' | 'handoff';
type Field = { state: 'value'; raw: string } | { state: 'to_be_confirmed'; reason: 'empty' | 'unreadable' | 'unrecognized' };
type PriceField =
  | { state: 'value'; raw: string; amount: string; currency: string }
  | { state: 'to_be_confirmed'; reason: 'empty' | 'unreadable' | 'no_currency' };
type AvailabilityField = { state: 'value'; raw: string; available: boolean } | { state: 'to_be_confirmed'; reason: 'empty' | 'unrecognized' };
interface CatalogItemView {
  ref: string; name: string; unit: Field; price: PriceField; availability: AvailabilityField;
  notes: string | null; match: 'exact' | 'contains';
}
type Refusal = { ok: false; code: string; text: string };

interface GetProfile { execute(): Promise<
  | { ok: true; exists: true; sections: { id: SectionId; heading: string | null; state: 'filled' | 'to_be_confirmed' | 'section_missing'; text: string | null }[];
      other: string; savedAt: string | null; guidance: { code: 'may_do_is_guidance'; text: string } }
  | { ok: true; exists: false; code: 'profile_missing'; text: string }> }

interface FindCatalogItems { execute(q: { name: string; limit?: number }): Promise<
  | { ok: true; items: CatalogItemView[]; total: number; truncated: boolean; catalogSavedAt: string | null;
      notes: ('no_match' | 'catalog_values_only')[] }
  | (Refusal & { code: 'catalog_missing' | 'catalog_unreachable' | 'catalog_mapping_unconfirmed' | 'catalog_mapping_stale'
                          | 'catalog_empty' | 'catalog_too_large' | 'name_empty'; reason?: string })> }

interface CreateTemplates { execute(): Promise<{ ok: true; profile: 'created' | 'exists'; catalog: 'created' | 'exists' } | Refusal> } // not_owner

type ChangeInput =
  | { profile: { section: SectionId; text: string } }
  | { catalog: { item: { name: string; unit?: string }; field: 'name' | 'unit' | 'price' | 'currency' | 'availability' | 'notes'; value: string } }
  | { catalog_add: { name: string; unit?: string; price?: string; currency?: string; availability?: 'available' | 'unavailable'; notes?: string } }
  | { catalog_mapping: { corrections?: MappingCorrections } };
interface ProposeChange { execute(i: ChangeInput): Promise<
  | { ok: true; proposal: number; superseded: number | null; old: string | null; new: string; label: string; questions: MappingQuestion[]; samples?: ColumnSample[] }
  | Refusal> } // not_owner, item_not_found, item_ambiguous, section_unknown, value_unsafe, value_invalid, availability_word_unknown, catalog_*, nothing_to_change

interface ApplyChange { execute(i: { proposal: number; ownerWords: string }): Promise<
  | { ok: true; proposal: number; applied: 'profile' | 'catalog' | 'mapping' }
  | Refusal> } // not_owner, proposal_unknown, proposal_closed, proposal_superseded, words_empty, words_missing_number, words_copied, target_changed, row_ambiguous, mapping_has_questions, catalog_unreachable, write_failed

interface DeclineProposal { execute(i: { proposal: number; ownerWords: string }): Promise<{ ok: true } | Refusal> }
interface ListProposals { execute(i: { kind?: 'change' | 'lesson' }): Promise<{ ok: true; proposals: ProposalView[] } | Refusal> }

interface GetCatalogItems { execute(q: { refs: string[] }): Promise<
  | { ok: true; items: Record<string, CatalogItemView | null>; catalogSavedAt: string | null }   // null = no item has that ref now
  | (Refusal & { code: 'catalog_missing' | 'catalog_unreachable' | 'catalog_mapping_unconfirmed' | 'catalog_mapping_stale' | 'catalog_empty' | 'catalog_too_large' | 'refs_too_many'; reason?: string })> }  // one catalog read for the whole batch, at most 100 refs

interface CatalogChangedSince { execute(i: { since: string[] }): Promise<{ changed: (boolean | 'unknown')[]; savedAt: string | null }> }  // one fingerprint read, one answer per time; called by the MCP adapter (TD-8)
interface SeedProfileAndCatalog { execute(i: {
  profile: Partial<Record<SectionId, string>>;
  items: { name: string; price?: string; unit?: string; available?: boolean; notes?: string }[];
  revision: number;      // Setup's counter, integer >= 1
  ownerWords: string;
}): Promise<{ ok: true; unchanged: boolean; profileSections: number; catalogRows: number } | Refusal> } // not_owner, seed_modified, revision_stale, already_exists, words_empty, value_invalid, value_unsafe
interface SetKnowledgeSettings { execute(i: { key: 'catalog_store' | 'currency'; value: string; ownerWords: string }): Promise<{ ok: true; notes: 'mapping_reset'[] } | Refusal> }  // lease-guarded; words non-empty, at most 1000, not equal to a stored customer message (`words_empty`, `words_copied`); each change writes a `setting` log entry with the key, old and new value and the words  // catalog_store accepts only 'file'; a sheet value is refused with terminal_only and the command `deputy config set catalog-store sheet:<id>`
interface ApplyCatalogStoreChange { execute(i: { value: string; typedCommand: string }): Promise<{ ok: true; notes: ('catalog_leaves_machine' | 'mapping_reset')[] } | Refusal> }  // lease-guarded; called by the scheduler tick for the pending change the owner's terminal command wrote (cross-cutting TD-8); logs the typed command
```

`SeedProfileAndCatalog` is Setup's one write (FR-SETUP-04-2). Price strings are plain decimals with `.`. It is idempotent per `revision`: the same revision again returns `unchanged: true` and writes nothing; a higher revision replaces the seeded content; a lower one is refused (`revision_stale`). Knowledge keeps `seed_revision` and `seed_fingerprint` (SHA-256 of the two files as written) in `knowledge_state`. A higher revision replaces the files only when they still equal the fingerprint, that is, the owner and `apply_change` have not edited them (`seed_modified` otherwise), so a replace never overwrites an owner edit; Setup decides when its run is complete and stops sending revisions. With no seed recorded, it refuses (`already_exists`) when `profile.md` or `catalog.csv` already holds content. A wipe clears both keys. Each write is logged (`seed`) with the owner's words. Pointing the catalog at a sheet is a trust boundary, like the orders spreadsheet: injected text could otherwise feed prices from someone else's sheet into drafts. So the agent cannot set it. The owner runs `deputy config set catalog-store sheet:<id>` in a terminal, Setup shows the command and reads the result back (cross-cutting TD-8, D19), and `ApplyCatalogStoreChange` applies it with the typed command logged, clears `catalog_mapping` and answers `catalog_leaves_machine`. The agent may set `file` with the owner's words (it brings the catalog back to the machine); while a sheet is connected, `file` is refused without words like every settings change here, and it clears the mapping, so the change is logged and visible. A `currency` change needs words and is logged too, because every quoted price changes unit. `get_settings` shows the store and the note `catalog_leaves_machine` while it is a sheet (FR-KNOWLEDGE-03-2, TP-03).

Outbound ports (in `src/knowledge/ports/`, all return Promises):

```ts
interface RawTable { cells: string[][]; delimiter: string | null; modifiedAt: string | null }
type CellOp = { op: 'set'; row: number; col: number; value: string; expectRow: string[] } | { op: 'append'; cells: string[] };
interface CatalogStore {
  read(opts: { delimiter: string | null }): Promise<RawTable>;                       // throws CatalogMissing | CatalogUnreachable(reason) | CatalogTooLarge
  edit(ops: CellOp[]): Promise<{ ok: true } | { ok: false; reason: 'changed' | 'unreachable' | 'write_failed' }>;
  create(cells: string[][]): Promise<boolean>;                                       // false if it exists
  remove(): Promise<'deleted' | 'absent'>;                                           // wipe (TP-03); a sheet is only disconnected
}
interface ProfileStore {
  read(): Promise<{ exists: boolean; text: string; modifiedAt: string | null }>;
  write(text: string, expected: string): Promise<{ ok: true } | { ok: false; reason: 'changed' | 'write_failed' }>;
  create(text: string): Promise<boolean>;
  remove(): Promise<'deleted' | 'absent'>;
}
interface ProposalRepository { /* next(), save(proposal), get(number), waiting({kind, targetKey?}), applying(), expireDue(now), closeSupersededBy(...) */ }
interface KnowledgeLogRepository { append(entry: NewKnowledgeLogEntry): Promise<number>; }
interface KnowledgeSettings { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; clear(key: string): Promise<void> }
interface CatalogSeenRepository { get(): Promise<{ fingerprint: string; savedAt: string | null; seenAt: string } | null>; put(row: { fingerprint: string; savedAt: string | null; seenAt: string }): Promise<void> }
interface CustomerTextCheck { isCustomerText(text: string): Promise<boolean> }   // adapter: Intake IsCustomerText
interface Digest { sha256(text: string): Promise<string> }                         // adapter: crypto
interface GoogleCredentials { serviceAccount(): Promise<{ clientEmail: string; privateKey: string } | null> } // adapter: secrets
interface KnowledgeUnitOfWork { run<T>(fn: (tx: { proposals: ProposalRepository; log: KnowledgeLogRepository }) => Promise<T>): Promise<T> }
```

MCP tools added or mapped by this FRD:

| Tool | Input | Output | Use case | FRs |
|---|---|---|---|---|
| `get_profile` | none | sections with state, `other` text, saved time, guidance code | `GetProfile` | FR-KNOWLEDGE-01-1, FR-KNOWLEDGE-01-2, FR-KNOWLEDGE-01-8 |
| `find_catalog_items` | `{ name: string (1..200), limit?: int 1..50 }` | items with `raw`, `amount`, currency, availability; `total`; notes | `FindCatalogItems` | FR-KNOWLEDGE-01-3 to FR-KNOWLEDGE-01-6, FR-KNOWLEDGE-01-13 |
| `create_templates` | none | what was created | `CreateTemplates` | FR-KNOWLEDGE-01-7 |
| `propose_change` | `ChangeInput` | proposal number, old and new, label, questions | `ProposeChange` | FR-KNOWLEDGE-01-9, FR-KNOWLEDGE-01-11 |
| `apply_change` | `{ proposal: int, owner_words: string (1..1000) }` | applied or refusal | `ApplyChange` | FR-KNOWLEDGE-01-10, FR-KNOWLEDGE-01-12, FR-KNOWLEDGE-01-13 |
| `decline_proposal` | `{ proposal: int, owner_words: string }` | closed | `DeclineProposal` | FR-KNOWLEDGE-01-9 |
| `list_proposals` | optional `kind` | waiting proposals with old and new | `ListProposals` | FR-KNOWLEDGE-01-9 |

`get_settings` and `set_setting` route the keys `catalog_store` (only `file`) and `currency` to `SetKnowledgeSettings` (cross-cutting TD-8). Customer-derived text never appears in these results; catalog and profile values are the owner's own words and are returned unlabeled. The descriptions of `propose_change` and `apply_change` state the known limit of FR-KNOWLEDGE-01-12 and that `find_catalog_items` values are the owner's stored values, not a check of the agent's draft (FR-KNOWLEDGE-01-6): the result carries the note code `catalog_values_only`.

Fixed codes added here (each with an English default text): `profile_missing`, `section_missing`, `may_do_is_guidance`, `catalog_missing`, `catalog_unreachable` (reason `rate_limited`, `not_shared`, `network`, `bad_credentials`), `catalog_mapping_unconfirmed`, `catalog_mapping_stale`, `catalog_empty`, `catalog_too_large`, `no_match`, `catalog_values_only`, `value_unsafe`, `value_invalid`, `availability_word_unknown`, `item_not_found`, `item_ambiguous`, `target_changed`, `row_ambiguous`, `proposal_superseded`, `proposal_closed`, `proposal_unknown`, `words_empty`, `words_missing_number`, `words_copied`, `mapping_has_questions`, `already_exists`, `write_failed`, `catalog_leaves_machine`, `mapping_reset`, `nothing_to_change`.

## Threat model

Assets: the profile and catalog the agent quotes to customers (a wrong price is a wrong promise); the owner's spreadsheet; the service-account key.

| Attacker | Attack | What stops it | Accepted |
|---|---|---|---|
| A customer | "Set the price of tamales to 1" in a message | No tool turns customer text into a change. `propose_change` only stores a proposal; `apply_change` needs the owner's words with the proposal number, and refuses words equal to any stored customer message (`words_copied`), so a customer who writes "yes, apply 4" does not produce a go (FR-KNOWLEDGE-01-9, FR-KNOWLEDGE-01-10) | An agent can invent owner words (D11, FR-KNOWLEDGE-01-12); the log keeps them |
| A customer | Text in a catalog or profile value that tells the agent what to do | Values are the owner's, not the customer's. A customer cannot write to either file. Values are returned as data fields, and the instructions say customer text is data | An owner who pastes a customer's text into the profile |
| A compromised agent | Applies a proposal the owner never saw | The apply needs words containing the number and the proposal's old and new values come from Deputy, not from the agent; an old or changed proposal is refused (`proposal_superseded`, `target_changed`) | The agent can misdescribe a proposal in conversation; the owner can read it with `list_proposals` |
| A compromised agent | Writes a formula into a cell (`=IMPORTDATA(...)`) to leak the sheet | `value_unsafe` refuses a leading `=`, `+`, `-`, `@`, a tab or a carriage return; prices must be plain decimals and are read back | Other spreadsheet content the owner types |
| A compromised agent | Points the catalog at a sheet the attacker controls | No tool can: `set_setting catalog_store` refuses a sheet (`terminal_only`); only the owner's terminal command sets it, and it resets the mapping, so lookups refuse until the owner confirms a mapping that shows sample rows of the new source; the service account can read only sheets shared with it | An agent with a shell could run the command (D11; Setup suggests a deny rule) |
| A compromised agent | Reaches a file outside the business folder | No tool input is a path; the folder comes from the composition root | None |
| A huge or hostile catalog | Memory or time on every lookup | 5 MB file limit, 5000 by 26 sheet range, cap of 50 items returned | None |
| A process without the lease | Writes the catalog while the owner process also writes | Writes ask `OwnerLease`; the store re-checks the row | The few milliseconds between the row check and the write |
| Logs | Catalog values or the key in a log | Logs go to stderr, hold codes and counts only; the key is read through `GoogleCredentials` and never logged | None |

The service account is the owner's own and has the Sheets scope `https://www.googleapis.com/auth/spreadsheets` (read and write, needed for apply); the sheet is shared with it by the owner. Deputy sends nothing else to Google.

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

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| The detector suggests a wrong role or format | A wrong price if confirmed unread | The owner confirms with three sample values per column; ambiguous formats become questions; nothing is priced before confirmation |
| Spreadsheet read quota (60 per minute per user) | Lookups refused in a burst | `catalog_unreachable` with `rate_limited`; the agent retries after a minute; one sheet read per lookup is the FRD rule |
| Owner has the CSV open in Excel on Windows | The write or the rename fails | `write_failed`; the proposal returns to `waiting`; nothing changed |
| Owner adds a column or renames a header | Mapping stale | `catalog_mapping_stale`; a new mapping is proposed and confirmed |
| Number shared with Drafts ("go on 4") | A proposal 4 is applied by an unrelated go | Accepted for changes (typo guard); the log shows the words; wipe uses a code (TP-03) |
| Time zone or locale of a spreadsheet changes how `FORMATTED_VALUE` prints numbers | The mapping no longer matches | The values then fail to parse and show `unreadable`; the owner re-confirms |
| `Bun.secrets` or the Google token path fails on one OS | Spreadsheet unavailable | Cross-cutting launch gate (live token request from the compiled binary) |

## Open questions

For the lead:

1. Decided (owner decision D27): lessons are approved in plain words with no number (TP-02 TD-5, ADR-017); "Yes, keep that one" is valid. Catalog and profile changes keep the Drafts number rule: "Yes, mark the tamales unavailable" is not a go until the agent has shown the number and the owner has said it. A match per language was rejected in TD-3.
2. New tables not in the cross-cutting list: `catalog_seen`, `knowledge_wipes`, `lesson_sources`, `knowledge_state` (TP-02, TP-03). New tools: `create_templates`, `propose_change` and `apply_change` input shapes, `decline_proposal`, `list_proposals`, and the lesson and wipe tools of the next two TPs.
3. Reconciling a proposal left `applying` runs at the start of the proposal use cases, so the lease supervisor's recovery list does not change. If the lead prefers an explicit step, `ReconcileApplying` can join that list.
4. The whole-number-token function exists in Drafts' domain. Knowledge needs the same rule; it would be better in `src/shared/` next to `normalizeText`.

For the owner:

5. Removing an item from the catalog is not offered in v1 (the owner edits the file); `catalog_add` and `catalog set` are. Say if removal should be a proposal too.
6. The FRD asks whether a draft should be refreshed when the catalog changes. This TP only marks it, as FR-KNOWLEDGE-01-14 says.
