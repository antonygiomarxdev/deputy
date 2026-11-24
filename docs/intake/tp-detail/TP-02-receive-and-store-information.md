# TP-02-receive-and-store: Information

Part of [TP-02-receive-and-store.md](../tp/TP-02-receive-and-store.md). Moved verbatim from there; nothing changed.

## Information

```sql
CREATE TABLE messages (
  seq                 INTEGER PRIMARY KEY AUTOINCREMENT,
  provider            TEXT    NOT NULL CHECK (provider IN ('kapso','dev')),
  provider_message_id TEXT    NOT NULL CHECK (provider_message_id <> ''),
  chat_id             TEXT    NOT NULL,
  conversation_ref    TEXT,
  sender              TEXT,
  provider_sender     TEXT,                 -- the sender id as the provider sent it (L8)
  type                TEXT    NOT NULL,
  readable            INTEGER NOT NULL CHECK (readable IN (0,1)),
  text                TEXT,
  text_norm           TEXT,
  transcript          TEXT,
  sent_at             INTEGER NOT NULL,
  stored_at           INTEGER NOT NULL,
  origin              TEXT,
  source              TEXT    NOT NULL CHECK (source IN ('customer','owner_app','sent_through_deputy')),
  mark                TEXT    NOT NULL DEFAULT 'normal'
                      CHECK (mark IN ('normal','group_chat','sender_unknown','not_attributable')),
  history             INTEGER NOT NULL CHECK (history IN (0,1)),
  dev                 INTEGER NOT NULL CHECK (dev IN (0,1)),
  edited              INTEGER NOT NULL DEFAULT 0,
  deleted_by_sender   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (provider, provider_message_id)
);
CREATE INDEX messages_chat   ON messages (chat_id, dev, sent_at, seq);
CREATE INDEX messages_conv   ON messages (conversation_ref, sent_at);
CREATE INDEX messages_newest ON messages (provider, sent_at);
CREATE INDEX messages_text_norm ON messages (text_norm) WHERE source = 'customer' AND text_norm IS NOT NULL;

CREATE TABLE message_versions (
  provider            TEXT    NOT NULL,
  provider_message_id TEXT    NOT NULL,
  version             INTEGER NOT NULL,
  text                TEXT,
  replaced_at         INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_message_id, version),
  FOREIGN KEY (provider, provider_message_id) REFERENCES messages (provider, provider_message_id)
);

CREATE TABLE chats (
  chat_id                  TEXT    NOT NULL,
  dev                      INTEGER NOT NULL CHECK (dev IN (0,1)),
  mark                     TEXT    NOT NULL DEFAULT 'normal',
  conversation_ref         TEXT,
  provider_id              TEXT,                 -- first counterpart id seen, as the provider sent it; the destination of a send (L8)
  last_customer_at         INTEGER,
  last_customer_message_id TEXT,
  last_answer_at           INTEGER,
  last_answer_source       TEXT CHECK (last_answer_source IN ('owner_app','sent_through_deputy')),
  last_unattributed_at     INTEGER,
  profile_name             TEXT,                 -- untrusted display hint, at most 80 graphemes (D28)
  updated_at               INTEGER NOT NULL,
  PRIMARY KEY (chat_id, dev)
);

CREATE TABLE rejections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  reason      TEXT    NOT NULL CHECK (reason IN
              ('bad_signature','missing_signature','no_secret','no_identifier','malformed','dev_entry_refused')),
  recoverable INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER
);
CREATE TABLE rejection_pruned (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  count         INTEGER NOT NULL,
  last_prune_at INTEGER
);
```

Rules for the tables:

- `last_customer_at` is the newest `sent_at` among messages of the chat with `source = 'customer'` and `mark = 'normal'`, history included. `last_answer_at` and `last_answer_source` come from the newest message with `source` of `owner_app` or `sent_through_deputy`. Both are recomputed, never patched (TD-2).
- The `ChatId` of a one-to-one chat is the customer's line key (`PhoneNumber.lineKey()`, TP-04 TD-2, ADR-012), so the two forms WhatsApp may report for one line (for example `5491123456789` and `541123456789`) are one chat. The id as the provider sent it is stored as received: the message's `provider_sender` and the chat's `provider_id` (the first one seen), and `provider_id` is the destination of a send. The sender field used for matching owner numbers is the sender's `PhoneNumber` compared with `sameLine`, or null.
- Text is stored exactly as received, in full (FR-INTAKE-02-10). No column is truncated.
- A prune on `rejections` keeps the newest 500 rows and nothing older than 30 days, and adds the deleted count to `rejection_pruned` in the same transaction (TD-3).
- Customer text exists only in `messages.text`, `messages.transcript` and `message_versions.text`. Logs and rejection notes hold none.

Port to the store. Every repository method returns a `Promise`, and `IntakeUnitOfWork.run` takes an async function, so a database adapter that is async or synced (cross-cutting TD-3) fits without changing a use case. The `bun:sqlite` adapter resolves at once. A transaction never contains a provider call, a sleep or any wait on another party:

```ts
export interface MessageRepository {
  insertIfNew(m: Message): Promise<"stored" | "duplicate">;
  find(id: MessageId): Promise<Message | null>;
  saveEdit(id: MessageId, version: MessageVersion, text: string): Promise<void>;
  markDeleted(id: MessageId): Promise<void>;
  /** Sent order: (sent_at, seq). Both worlds; each message carries dev. */
  listChat(chat: ChatId, q: { limit: number; before?: Instant }): Promise<Message[]>;
  chatExists(chat: ChatId): Promise<{ exists: boolean; hasNonDevMessage: boolean }>;
}
export interface ChatStateRepository {
  recompute(chat: ChatId, dev: boolean): Promise<void>;
  /** Only the world that matches the active provider. */
  list(q: { dev: boolean; customerMessageSince?: Instant }): Promise<ChatState[]>;
  get(chat: ChatId, dev: boolean): Promise<ChatState | null>;
}
export interface RejectionRepository {
  add(at: Instant, reason: RejectionReason, recoverable: boolean): Promise<void>;   // prunes in the same call
  list(): Promise<{ notes: RejectionNote[]; prunedCount: number; unrecovered: number }>;
  resolveRecoverableBefore(runStartedAt: Instant, at: Instant): Promise<void>;
}
export interface IntakeUnitOfWork {
  run<T>(work: (r: IntakeRepos) => Promise<T>): Promise<T>;   // one transaction; no provider call inside
}
export interface EventPublisher { publish(e: IntakeEvent): void }   // in-process, fire and forget
```
