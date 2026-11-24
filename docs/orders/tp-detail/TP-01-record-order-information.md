# TP-01-record-order: Information

Part of [TP-01-record-order.md](../tp/TP-01-record-order.md). Moved verbatim from there; nothing changed.

## Information

The aggregate and its parts:

- `Order` (root): `id: OrderId`, `draftRef: DraftRef`, `createdAt: Instant`, `customer: {name, chat}`, `items: OrderItem[]`, `fulfillment`, `address`, `wanted: {date, time?} | null`, `total`, `notes`, `status`, `sourceMessages: MessageId[]`, `history: ChangeEntry[]`.
- `OrderItem`: `position`, `catalogRef | null`, `nameAsWritten`, `quantity: Quantity`, `unit`, `snapshot | null`.
- `ChangeEntry`: `at`, `field`, `oldValue`, `newValue`, `ownerWords` (TP-02).
- `DeletedMark`: `orderId`, `deletedAt` (TP-02).
- Domain event `OrderDeleted {eventId, orderId, draftNumber, chat}` (TP-02).

SQLite tables owned by this FRD (the cross-cutting TP names `orders`, `order_items`, `order_history`, `order_messages`, `order_deleted`; TP-02 adds the rest):

```sql
CREATE TABLE orders_instance (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  install_id TEXT NOT NULL
);

CREATE TABLE orders (
  id              TEXT PRIMARY KEY,
  draft_ref       TEXT NOT NULL UNIQUE,
  created_at      INTEGER NOT NULL,                       -- epoch ms
  status          TEXT NOT NULL CHECK (status IN ('new','confirmed','ready','delivered','cancelled')),
  customer_name   TEXT NOT NULL DEFAULT '',
  chat            TEXT NOT NULL CHECK (chat <> ''),
  fulfillment     TEXT NOT NULL CHECK (fulfillment IN ('pickup','delivery')),
  address         TEXT NOT NULL DEFAULT '',
  wanted_date     TEXT CHECK (wanted_date IS NULL OR wanted_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  wanted_time     TEXT CHECK (wanted_time IS NULL OR wanted_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  total_minor     INTEGER CHECK (total_minor IS NULL OR total_minor >= 0),   -- minor units; NULL = to be confirmed
  total_currency  TEXT,
  total_tbc       TEXT,                                   -- reason code when total is NULL
  notes           TEXT NOT NULL DEFAULT '',
  CHECK (fulfillment <> 'delivery' OR address <> ''),
  CHECK ((total_minor IS NULL) = (total_tbc IS NOT NULL))
);
CREATE INDEX orders_by_chat ON orders (chat);

CREATE TABLE order_items (
  order_id      TEXT NOT NULL,
  position      INTEGER NOT NULL,
  catalog_ref   TEXT,                                     -- NULL = not in catalog
  name_written  TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),   -- thousandths
  unit          TEXT NOT NULL DEFAULT '',
  snap_name     TEXT, snap_unit TEXT, snap_price_minor INTEGER, snap_currency TEXT,
  PRIMARY KEY (order_id, position),
  CHECK ((catalog_ref IS NULL) = (snap_name IS NULL))
);

CREATE TABLE order_messages (
  order_id   TEXT NOT NULL,
  message_id TEXT NOT NULL,
  PRIMARY KEY (order_id, message_id)
);
CREATE INDEX order_messages_by_message ON order_messages (message_id);
```

The same fields are the columns of the spreadsheet tab (TP-03). `order_history` is in TP-02.
