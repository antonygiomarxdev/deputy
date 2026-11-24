# TP-04-owner-echoes: Information

Part of [TP-04-owner-echoes.md](../tp/TP-04-owner-echoes.md). Moved verbatim from there; nothing changed.

## Information

```sql
CREATE TABLE owner_numbers (
  number    TEXT PRIMARY KEY,                       -- normalized digits
  kind      TEXT NOT NULL CHECK (kind IN ('business','extra')),
  label     TEXT NOT NULL DEFAULT '',
  added_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX owner_numbers_one_business ON owner_numbers (kind) WHERE kind = 'business';

CREATE TABLE owner_number_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       INTEGER NOT NULL,
  action   TEXT    NOT NULL CHECK (action IN ('add','remove')),
  number   TEXT    NOT NULL,
  kind     TEXT    NOT NULL CHECK (kind IN ('business','extra')),
  label    TEXT    NOT NULL DEFAULT '',
  command  TEXT    NOT NULL                          -- the command the owner typed
);
CREATE TRIGGER owner_number_log_no_update BEFORE UPDATE ON owner_number_log
  BEGIN SELECT RAISE(ABORT, 'owner_number_log is append-only'); END;
CREATE TRIGGER owner_number_log_no_delete BEFORE DELETE ON owner_number_log
  BEGIN SELECT RAISE(ABORT, 'owner_number_log is append-only'); END;

CREATE TABLE outgoing (
  send_id        TEXT PRIMARY KEY CHECK (length(send_id) BETWEEN 1 AND 100),
  chat_id        TEXT    NOT NULL,
  text           TEXT    NOT NULL,
  parts_total    INTEGER NOT NULL CHECK (parts_total >= 1),
  state          TEXT    NOT NULL CHECK (state IN ('pending','sent','failed','unknown')),
  failure_reason TEXT,
  created_at     INTEGER NOT NULL,
  finished_at    INTEGER
);

CREATE TABLE outgoing_parts (
  send_id             TEXT    NOT NULL REFERENCES outgoing (send_id),
  part                INTEGER NOT NULL,
  text                TEXT    NOT NULL,
  provider            TEXT,
  provider_message_id TEXT,
  state               TEXT    NOT NULL CHECK (state IN ('pending','sent','failed','unknown')),
  PRIMARY KEY (send_id, part),
  UNIQUE (provider, provider_message_id)
);

CREATE TABLE source_changes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  at                  INTEGER NOT NULL,
  provider            TEXT    NOT NULL,
  provider_message_id TEXT    NOT NULL,
  from_source         TEXT    NOT NULL,
  to_source           TEXT    NOT NULL,
  send_id             TEXT    NOT NULL
);
```

Rules:

- `owner_numbers` and its log change only inside `ApplyPendingChanges`, in one transaction, never through a tool (L4).
- `pending_changes` (cross-cutting Information) rows read by Intake: key `owner_numbers` (value: the full list of extra numbers, comma separated) key `business_number` (one number or empty) and key `owner_number_remove` (one number, written by `deputy config remove owner-number <number>`). `ApplyPendingChanges` compares the value with the current set, adds the missing numbers, removes the absent extras, and writes one log row for each, with the typed command from the row. It then sets the row's applied time. A removal row is applied and logged like a set: the number (matched by `sameLine`) leaves the extras and one `remove` log row keeps the typed command (L4). A removal of the business number, or of a number not in the set, changes nothing: the row is marked applied and the refusal goes to stderr, because the business number changes only through `deputy config set business-number` (a missing business number turns every owner reply into a customer message).
- `DescribeNumber` parses `raw` through `PhoneNumberParser` with `defaultCountry` (ADR-012) and answers `unparseable` or `needs_country_code` when the parser does. `customerMessages` counts the stored non-dev messages with source `customer` in the chat whose id is the number's line key (the chat id of a one-to-one chat, TP-02). It writes nothing and is not lease-guarded. A row with an invalid number is marked applied with no change and logged to stderr; the command line already refuses such a value.
- `outgoing.text` is the exact text Drafts passed. It is customer-facing text, not secret, and stays on the owner's machine.
- A Deputy send that failed leaves an `outgoing` row (state `failed`, a reason from a fixed set) and no `messages` row.
- The messages Deputy sent have `source = 'sent_through_deputy'`, `sender` = the business number when configured, `sent_at` = the `serverTime` of the send response, `origin = NULL`.

Ports:

```ts
export interface OwnerNumbersRepository {
  load(): Promise<OwnerNumbers>;
  save(o: OwnerNumbers, log: ReadonlyArray<OwnerNumberLogEntry>): Promise<void>;   // one transaction
  log(): Promise<OwnerNumberLogEntry[]>;
}
export interface OutgoingRepository {
  find(sendId: SendId): Promise<OutgoingSend | null>;
  insert(s: OutgoingSend): Promise<void>;
  savePart(s: OutgoingSend, part: number): Promise<void>;
  findByProviderId(provider: ProviderName, providerMessageId: string): Promise<{ sendId: SendId; part: number } | null>;
  markPendingAsUnknown(): Promise<number>;
  /** Owner-number messages of a chat with this exact text, not yet linked to any send. */
  candidatesForPart(chat: ChatId, text: string, since: Instant): Promise<MessageId[]>;
}
export interface PendingChangesReader {
  takeOwnerNumberChanges(): Promise<PendingChange[]>;     // unapplied rows with keys owner_numbers, business_number
  markApplied(id: number, at: Instant): Promise<void>;
}
```
