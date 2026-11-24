# TP-01-pending-detection: Information

Part of [TP-01-pending-detection.md](../tp/TP-01-pending-detection.md). Moved verbatim from there; nothing changed.

## Information

Domain model.

```ts
// src/inbox/domain/pending-window.ts  (no imports outside domain and src/shared)
export class PendingWindow {
  static readonly DEFAULT_DAYS = 7;       // D3
  static readonly MS_PER_DAY = 86_400_000;
  static of(days: number): PendingWindow;  // throws NotAnInteger or BelowMinimum (minimum 1)
  readonly days: number;
  startAt(now: Instant): Instant;          // now - days * MS_PER_DAY
}

// Aggregate. One instance. Invariant: window.days >= 1 and an integer.
export class InboxSettings {
  static initial(): InboxSettings;         // 7 days
  readonly window: PendingWindow;
  setWindow(requested: number, maxAllowed: number): { applied: number; clamped: boolean };
}

export interface ChatFacts {               // no text field exists, so no rule can read text (FR-INBOX-01-5)
  chat: ChatId;
  mark: Mark;
  lastCustomerAt: Instant | null;
  lastAnswerAt: Instant | null;
  lastAnswerSource: "owner_app" | "sent_through_deputy" | null;
}

export type Verdict =
  | { kind: "pending" }
  | { kind: "answered"; by: "owner_app" | "sent_through_deputy" }
  | { kind: "no_customer_message" }                    // the owner wrote first
  | { kind: "outside_window" }                         // unanswered, older than the window
  | { kind: "ignored_unanswered"; inWindow: boolean }
  | { kind: "not_handled" }                            // group chat, sender unknown, not attributable
  | { kind: "needs_tiebreak" };                        // lastCustomerAt === lastAnswerAt

export const PendingPolicy: {
  judge(f: ChatFacts, ctx: { windowStart: Instant; ignored: boolean; newestIsCustomer?: boolean }): Verdict;
};
```

Invariants of `InboxSettings`: `setWindow` with a value that is not an integer or is below 1 throws and changes nothing (FRD-01 edge case: the old value stays). A value above `maxAllowed` stores `maxAllowed` and returns `clamped: true`.

`PendingPolicy.judge`, in order:

1. `mark !== "normal"` gives `not_handled`.
2. `lastCustomerAt === null` gives `no_customer_message`.
3. Answered: `lastAnswerAt !== null` and (`lastAnswerAt > lastCustomerAt`, or equal with `newestIsCustomer === false`). Equal with `newestIsCustomer` undefined gives `needs_tiebreak`. An answered chat gives `answered` with its source, ignored or not.
4. Unanswered and ignored gives `ignored_unanswered` with `inWindow = lastCustomerAt >= windowStart`.
5. Unanswered and `lastCustomerAt < windowStart` gives `outside_window`.
6. Otherwise `pending`.

A customer who writes again after an answer has `lastCustomerAt > lastAnswerAt`, so the chat is pending again with no extra rule (FR-INBOX-01-4). A failed or approved-but-unsent draft stores no message, so `lastAnswerAt` does not move (FR-INBOX-01-2).

The scan.

```ts
export interface Scan {
  now: Instant;
  window: PendingWindow;
  windowStart: Instant;
  pending: ReadonlyArray<ChatFacts>;
  answered: ReadonlyArray<ChatFacts & { by: "owner_app" | "sent_through_deputy" }>;
  ignoredTotal: number;                         // entries on the ignore list (TP-03)
  ignoredUnansweredInWindow: ReadonlyArray<ChatId>;
  outsideWindow: ReadonlyArray<ChatId>;
  notHandledMessages: number;                   // FR-INBOX-01-13
}
```

`ChatScanner.scan({ sinceForListing?: Instant })`: load settings and the ignore list; `MessageReader.listChats(...)`; judge each chat; resolve `needs_tiebreak` with `MessageReader.readChat({ chat, limit: 5 })` (the newest non-dev message's source decides) and judge again; count `notHandledMessages` as follows. For each chat with a mark other than `normal` whose `lastCustomerAt` is null or at or after `windowStart`, read it with `ReadChat` (no limit) and count the messages with source `customer`, `dev = false`, `sentAt >= windowStart` and `sentAt > lastAnswerAt` (or any, when there is no answer). Why a full read here: these chats are few (groups, unknown senders, and the single `unattributed` chat) and the count must be exact, because the line tells the owner how many messages are not handled (principle 3).

`CountWaiting` calls `scan` with `sinceForListing = windowStart`, so only chats with a recent customer message are read from Intake, and returns the `pending` chat ids.

SQL. Inbox owns no table in this TP. Its one setting is a row of the shared `settings` table (cross-cutting Information), created by the shared migration and shown here for reference:

```sql
-- shared table, defined once in migrations/0001-init.sql; one owning slice per key
CREATE TABLE settings (
  key        TEXT    PRIMARY KEY,
  value      TEXT    NOT NULL,
  changed_at INTEGER NOT NULL
);
-- Inbox's only key: 'pending_window_days', value '7' by default (absent row = default)
```

The SQLite adapter reads and writes that key with `INSERT ... ON CONFLICT (key) DO UPDATE`. A missing row means the default. The adapter's contract test runs against the in-memory and SQLite adapters.
