# TP-01-record-order: Interfaces

Part of [TP-01-record-order.md](../tp/TP-01-record-order.md). Moved verbatim from there; nothing changed.

## Interfaces

Inbound ports (published through `src/orders/index.ts`):

```ts
interface PrepareOrder {            // behind Drafts' OrderPreparer.prepare
  run(q: { chat: string; order: OrderInput }): Promise<
    | { ok: true; payload: string; summary: string }
    | { ok: false; reasons: string[] }>;     // codes such as "customer_chat_missing", "items_missing", "item_unresolved:2",
}                                              // "quantity_invalid:1", "fulfillment_missing", "address_missing", "wanted_invalid",
                                               // "catalog_unavailable", "message_not_found:m7", "not_owner"
interface RevalidateOrder { run(q: { payload: string }): Promise<{ catalogChanged: boolean }> }
interface RecordOrder {
  run(q: { draftNumber: number; payload: string; ownerWords: string }): Promise<
    | { ok: true; orderId: string; createdAt: number; alreadyRecorded: boolean }
    | { ok: false; reason: 'not_owner' | 'words_empty' | 'payload_invalid' | 'store_unavailable' | 'outcome_unknown' | 'layout_mismatch' | 'store_full_or_read_only' }>;
}
type OrderInput = {
  customer_name?: string;
  items: Array<{ name: string; quantity: string | number; unit?: string; catalog_ref?: string; not_in_catalog?: true }>;
  fulfillment: 'pickup' | 'delivery'; address?: string;
  wanted_date?: string; wanted_time?: string; notes?: string;
  messages: string[];                 // ids of the customer messages the order is built from
};
```

`PrepareOrder` steps: lease check; validate fields and limits; for each item with `catalog_ref`, one batched `CatalogLookup.resolve` (refused with `catalog_unavailable` when it fails, `item_unresolved:<n>` when a ref is unknown or an item has neither ref nor mark); `MessageReader.customerMessagesIn(chat, ids)` must find every id as a customer message in that chat (one `GetMessages` call) (an unknown id would hide a pending message from Inbox, so it is refused); build the `Order` and total; encode the payload; build the summary. The summary is fixed English labels with every customer-derived value inside `<customer_text>...</customer_text>`, and `<` and `&` inside those values escaped as `&lt;` and `&amp;`, so a note cannot close the tag (FR-ORDERS-01-9):

```
customer: <customer_text>Juan Perez</customer_text> chat: 5551234
items: 2 x tamales (pork) [catalog] 120.00 USD; 1 x salsa [not in catalog]
fulfillment: pickup; wanted: 2026-11-21 10:00
total: to be confirmed (price_unknown)
notes: <customer_text>no chili</customer_text>
```

`RecordOrder` steps: lease check; `ownerWords` non-empty; parse payload (unknown version is `payload_invalid`); inside the `WriteSerializer`: `findByDraftRef`; found means return `alreadyRecorded: true`; else build `Order.record(...)` (re-checks the invariants), generate the id and `createdAt` from the `Clock`, `insert`; on a failed write apply TD-6. Failure kinds map to the reason codes above. Drafts reads any `ok: false` as a refusal (Drafts TP-03). Flag to the lead: for `outcome_unknown` Drafts should not mark the draft `failed` with a go that "carries over" (FRD edge case); it should show the owner the unknown outcome and call `RecordOrder` again only when the owner says so.

`ChatsWithOrders` and `IsMessageRecorded` (for Inbox, FR-ORDERS-01-17, FR-ORDERS-01-19):

```ts
interface ChatsWithOrders { run(q?: { statuses?: OrderStatus[] }): Promise<{ ok: true; chats: string[] } | { ok: false; reason: string }> }  // default new, confirmed; ids only
interface IsMessageRecorded { run(q: { messages: string[] }): Promise<{ ok: true; recorded: Record<string, { orderId: string } | null> } | { ok: false; reason: string }> }
```

`IsMessageRecorded` takes a list because the spreadsheet adapter reads the whole tab once per call (a limit of 60 reads per minute per user, TP-03), so Inbox must ask for a batch. Flag to the lead: cross-cutting Interfaces shows a single message; tp-inbox should call the batch form. A deleted order answers null.

Outbound ports (in `ports/`, interfaces only):

```ts
type StoreFailure = { kind: 'unreachable' | 'layout_mismatch' | 'read_only_or_full' | 'outcome_unknown' | 'conflict'; detail?: string };
type StoreResult<T> = { ok: true; value: T } | { ok: false; failure: StoreFailure };

interface OrderRepository {                                  // adapters: SQLite, spreadsheet (TP-03)
  findByDraftRef(ref: string): Promise<StoreResult<Order | null>>;
  get(id: string): Promise<StoreResult<Order | null>>;       // with history
  readAll(o: { withHistory: boolean }): Promise<StoreResult<{ orders: Order[]; unreadable: UnreadableOrder[] }>>;
  insert(order: Order): Promise<StoreResult<void>>;          // 'conflict' when id or draft_ref exists
  update(order: Order, newHistory: readonly ChangeEntry[]): Promise<StoreResult<void>>;   // TP-02
  remove(id: string): Promise<StoreResult<void>>;            // TP-02
  count(): Promise<StoreResult<number>>;                     // TP-03
}
interface CatalogLookup {                                    // adapter calls Knowledge's published port
  resolve(refs: readonly string[]): Promise<
    | { ok: true; items: Record<string, { ref: string; name: string; unit: string | null; price: { amount: string; currency: string } | null; available: boolean | null } | null> }
    | { ok: false; reason: string }>;
}
// Adapter mapping (catalog/ folder): calls Knowledge GetCatalogItems({refs}) (published, aligned with tp-knowledge); unit and price with state value map to the strings, to_be_confirmed maps to null;
// any Knowledge refusal (catalog_unreachable, catalog_mapping_unconfirmed, ...) becomes { ok: false, reason: 'catalog_unavailable:<code>' }.
interface MessageReader {                                    // adapter calls Intake GetMessages({ids}) and keeps the views whose chat equals `chat` and whose source is customer
  customerMessagesIn(chat: string, ids: readonly string[]): Promise<{ ok: true; found: ReadonlySet<string> } | { ok: false; reason: string }>;
}
interface CurrencyExponent { of(code: string): number | null }   // adapter: Intl, null for a code outside Intl.supportedValuesOf('currency')
interface OrderIds { next(): string }                        // 8 base32 characters from crypto.getRandomValues
interface InstallId { get(): Promise<string> }               // reads orders_instance, creates it once
```
`Clock` and `OwnerLease` come from the shared kernel. An id that `GetMessages` does not return, or that belongs to another chat or is not a customer message, is refused with `message_not_found:<id>`. Orders is written against `GetMessages`; the adapter test uses a fake of it.

MCP tools added by this FRD: none (cross-cutting Interfaces). `create_draft`, `change_draft` and `approve_draft` (Drafts) reach these use cases. The MCP adapter wraps the summary as the cross-cutting TP says.
