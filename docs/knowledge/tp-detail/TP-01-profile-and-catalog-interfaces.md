# TP-01-profile-and-catalog: Interfaces

Part of [TP-01-profile-and-catalog.md](../tp/TP-01-profile-and-catalog.md). Moved verbatim from there; nothing changed.

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
