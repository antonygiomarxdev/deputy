# Technical Proposal: Draft lifecycle (Drafts FRD-01)

Status: proposed. Follows the cross-cutting TP (`docs/tp/TP.md`); "cross-cutting TD-n" always means a decision there. This TP also holds the domain model, state machine and the `drafts` table that TP-02, TP-03 and TP-04 build on.

## Context

The cross-cutting TP fixes: Drafts is a bounded context with `domain`, `application`, `ports`, `adapters` (cross-cutting TD-0); data is SQLite behind a `SqlDatabase` port and a per-slice `UnitOfWork` (cross-cutting TD-3); every write use case asks `OwnerLease.isOwner()` first (cross-cutting TD-2); reply and order drafts share one numbering (L5). Only one sane way exists for each of these, so they are not decisions here.

Consequences used below:
- The domain does no I/O. Time comes from the `Clock` port, ids and numbers from ports.
- A draft is created only after Intake confirms the chat (`ChatExists`) and, with a real provider, a non-dev message exists (FR-DRAFTS-01-8, cross-cutting TD-6).
- An order draft is prepared by Orders' `PrepareOrder` through the `OrderPreparer` port. Drafts keeps the result as an opaque string and never reads it.
- `list_drafts` marks the returned version as shown. `approve_draft` needs that mark (cross-cutting TD-6). `ListDrafts` writes the mark only in the owner process (a second session is read-only, D16).
- Draft identifiers are plain integers. The list prints "Draft 3". This answers FRD-01 open question 3.

Two additions to the cross-cutting design, flagged for the lead:
- A draft whose outcome is "unknown" cannot be replaced or have its text changed. Replacing it would lose the draft that `ResolveUnknownSends` must link, and a corrected text could be sent twice. The owner rejects it first, or waits for it to resolve. A "failed" draft can be replaced.
- The state "approved" exists only inside one transaction (cross-cutting TD-6 marks the approval used and the draft "sending" in one step). It is never stored. Tests for "approved but not yet sent" run on the `Draft` aggregate and on held drafts.

## Requirements served

FR-DRAFTS-01-1, FR-DRAFTS-01-2, FR-DRAFTS-01-3, FR-DRAFTS-01-4, FR-DRAFTS-01-5, FR-DRAFTS-01-6, FR-DRAFTS-01-7, FR-DRAFTS-01-8.

## Decisions

### TD-1: How is a draft number given?

- **Option A** A one-row counter table. `DraftRepository.nextNumber()` increments it inside the unit of work. Cost: one extra write per draft. Risk: none known; a rolled-back transaction rolls the counter back.
- **Option B** `AUTOINCREMENT` on the drafts table. Cost: no counter table. Risk: the number exists only after the insert, so the aggregate and its events are built twice, and the rule depends on one SQL feature.
- **Option C** A random id as the key and a display number given at listing time (the position in the list). Cost: no counter. Risk: the display number changes when drafts close, so "go on 3" could name a different draft than the owner saw, which FR-DRAFTS-01-1 forbids.

Chosen: Option A. The domain needs the number when it builds the draft and its events, and the plain SQL keeps another database adapter possible (cross-cutting TD-3). Recorded in ADR-001.

### TD-2: How does a draft remember the message it answers?

- **Option A** Store the message id and the sent time, and read the text from Intake when listing. Cost: one Intake call per listed draft. Risk: Intake may not return the message; the view says so and still lists the draft.
- **Option B** Copy the customer text into the draft. Cost: one more column. Risk: a second copy of customer data that goes stale when the customer edits the message (FR-INTAKE-02-12).

Chosen: Option A, because the list then shows the text as Intake holds it now, and no customer text sits in two places. Recorded in ADR-002.

## Architecture

```mermaid
stateDiagram-v2
  [*] --> waiting: create
  waiting --> waiting: change text
  waiting --> sending: approve reply
  waiting --> recording: approve order
  waiting --> rejected: reject
  waiting --> replaced: new draft
  sending --> held: check finds news or catch-up fails
  sending --> sent: provider accepted
  sending --> failed: provider refused
  sending --> unknown: outcome not known
  recording --> recorded: order recorded
  recording --> failed: order refused
  recording --> unknown: order outcome unknown
  recording --> held: check finds news
  held --> waiting: change text
  held --> sending: approve again
  held --> recording: approve again
  held --> rejected: reject
  held --> replaced: new draft
  failed --> sending: approve again
  failed --> waiting: change text
  failed --> rejected: reject
  failed --> replaced: new draft
  unknown --> sent: found by resolve
  unknown --> sending: approve again
  unknown --> recording: approve order again
  unknown --> rejected: reject
  sent --> [*]
  recorded --> [*]
  rejected --> [*]
  replaced --> [*]
```

Layout of `src/drafts/`:

| Folder | Holds |
|---|---|
| `domain/` | `Draft`, `Approval`, `DraftNumber`, `DraftKind`, `DraftState`, `MessageMark`, `OwnerWordsPolicy` (TP-02), `FreshnessPolicy` (TP-03), `LogEntry` and `DraftLog` (TP-04), domain events |
| `application/` | one file per use case: `CreateDraft`, `ListDrafts`, `ChangeDraft`, `RejectDraft`, `WaitingChats`, then those of TP-02 to TP-04 |
| `ports/` | the inbound ports of `index.ts`, and the outbound ports below |
| `adapters/` | `sqlite/` (repositories, unit of work), `intake/` (`ChatReader`, and TP-02 to TP-03 ports), `orders/` (`OrderPreparer`, `OrderRecorder`), `mcp` tool definitions live in `src/adapters/mcp/` and call the inbound ports |

Domain model.

- `Draft` (aggregate root). Fields:
  - `number: DraftNumber`, `kind: 'reply' | 'order'`, `chat: ChatId`, `state: DraftState`.
  - `proposedText`, `currentText` (verbatim, never trimmed or reformatted; this answers FRD-01 open question 1), `textVersion` (rises on each text change), `shownVersion: number | null`, `revision` (rises on every save; TP-02).
  - `madeAt`, `dev: boolean` (the world it was made in), `answers: MessageMark | null`, `basis: MessageMark`, `checkedThrough: { sentAt, storedAt }` (TP-03), `pendingChoice: boolean` (TP-03), `holdReason`, `failReason`, `orderPayload: string | null`, `orderId: string | null`.
  - `approval: Approval | null` (the live approval, TP-02).
- `MessageMark = { messageId: MessageId; sentAt: Instant }`.
- Invariants: text non-empty after trimming; one open draft per `(chat, kind)` where open means waiting, held, failed, unknown, sending or recording (the approved state is transient); a draft in "sending" or "recording" cannot be replaced, changed or rejected; a draft in "unknown" cannot be replaced or changed; a closed draft (sent, recorded, rejected, replaced) accepts nothing; the number never changes.
- Methods return domain events and change nothing outside the aggregate: `Draft.propose(...)`, `changeText(text, words, now)`, `reject(words, now)`, `replaceBy(number, now)`, `markShown()`, and those of TP-02 and TP-03 (`approve`, `startSending`, `hold`, `finishSent`, `finishFailed`, `finishUnknown`).
- Events: `DraftProposed`, `DraftReplaced`, `TextChanged`, `DraftRejected`, `ApprovalVoided` (TP-02), `DraftHeld`, `OwnerChose`, `SendStarted`, `DraftSent`, `SendFailed`, `OutcomeUnknown`, `OrderRecorded`. Each carries the draft number, chat and time. The use case turns them into log entries (TP-04) in the same transaction.
- Voiding rule: `changeText`, `reject` and `replaceBy` void a live approval and emit `ApprovalVoided` (FR-DRAFTS-01-5, FR-DRAFTS-01-7).

Use cases (inbound ports, in `ports/` and re-exported by `index.ts`):

```ts
type OrderInput = Readonly<Record<string, unknown>>; // validated by Orders' PrepareOrder

interface CreateDraft {
  run(input:
    | { kind: 'reply'; chat: string; text: string }
    | { kind: 'order'; chat: string; order: OrderInput }
  ): Promise<CreateDraftResult>;
}
type CreateDraftResult = {
  number: number; kind: 'reply' | 'order'; state: 'waiting';
  text: string;                       // exactly what would be sent (order: Orders' summary)
  answers: MessageView | null;
  replaced: { number: number; state: 'waiting' | 'held' | 'failed' } | null;
};
// Errors: NotOwner, ChatNotFound, NoCustomerMessage, DevMessagesOnly, EmptyText,
//         OrderRejected(reasons), SendInProgress(number), OutcomeUnknownOpen(number)

interface ListDrafts {
  run(input: { chat?: string }): Promise<DraftView[]>;
}
type DraftView = {
  number: number; kind: 'reply' | 'order'; chat: string; state: DraftState;
  text: string; madeAt: string; answers: MessageView | { unavailable: true } | null;
  catalogChanged: boolean; holdReason: string | null; failReason: string | null;
  fromEarlierSession: boolean;        // D25: madeAt is before this session started
  retryAt: string | null;             // TP-03: a rate-limited send waits until then
};
// Lists drafts in waiting, held, failed, unknown, sending and recording; closed drafts are not listed.

interface ChangeDraft {
  run(input: { number: number; text?: string; order?: OrderInput; ownerWords: string }): Promise<ChangeDraftResult>;
}
type ChangeDraftResult = { number: number; state: 'waiting'; approvalVoided: boolean };
// Errors: NotOwner, DraftNotFound, DraftClosed(state), SendInProgress, OutcomeUnknownOpen,
//         EmptyText, OrderRejected, WrongKind (text on an order, or order on a reply)

interface RejectDraft {
  run(input: { number: number; ownerWords: string }): Promise<{ number: number; state: 'rejected' }>;
}
// Errors: NotOwner, DraftNotFound, DraftClosed(state), SendInProgress

interface WaitingChats {
  run(): Promise<WaitingChat[]>;
}
type WaitingChat = { number: number; kind: 'reply' | 'order'; chat: string; writtenAt: string;
                     state: 'waiting' | 'held' | 'failed' | 'unknown';
                     earlierSession: boolean };   // D25: made before this session started
// approved, sending and recording are reported as "waiting"; no draft text is returned (FR-DRAFTS-01-4).
```

`MessageView = { id, sentAt, text, source }`. The MCP adapter wraps `text` in a labeled block (cross-cutting Interfaces).

`CreateDraft` flow: lease check; `ChatReader.describe(chat)`; read the clock first, then ask Intake (so `checked_stored_at` is earlier than anything Intake can already hold, and a late echo stored in between still counts as new); refuse when the chat is unknown, has no customer message, or (when `activeWorldIsDev` is false) has no non-dev message; for an order, `OrderPreparer.prepare`; then one unit of work: load the open draft of the same kind; refuse if it is sending, recording or unknown; `nextNumber`; `Draft.propose`; replace the old one (events `DraftReplaced`, `ApprovalVoided` when it had one); save both; append the log entries.

`ChangeDraft` on an order draft calls `OrderPreparer.prepare` again with the new order and stores the new summary and payload.

Drafts never calls Knowledge. For an order draft, `ListDrafts` sets `catalogChanged` from `OrderPreparer.revalidate(payload)`, which compares the snapshotted item prices. The "catalog changed since this draft" mark for every draft, reply or order (FR-KNOWLEDGE-01-14), is composed by the `list_drafts` MCP adapter: it calls `ListDrafts`, then Knowledge's `CatalogChangedSince({ since: [each draft's madeAt] })` once, and merges the answers into the tool result (cross-cutting Interfaces; Knowledge TD-8). `changed: true` is the mark; `'unknown'` (the catalog is unreachable or has no baseline) shows the code `catalog_check_unavailable` and no mark, so the agent tells the owner to check the prices itself. The mark is set when either source says changed.

`ListDrafts` wraps every customer-derived field in `<customer_text>` after escaping with the shared helper `src/adapters/mcp/customer-text.ts` (it escapes `&`, `<` and `>`; Inbox's `get_chat` and Inbox's tools use the same one). Those fields are the message answered and the draft text, which may carry customer words (FR-INBOX-02-10).

Outbound ports for this TP (the others are in TP-02 and TP-03):

```ts
interface DraftRepository {                       // all methods take part in the UnitOfWork
  nextNumber(): Promise<DraftNumber>;
  get(number: DraftNumber): Promise<Draft | null>;
  openFor(chat: ChatId, kind: DraftKind): Promise<Draft | null>;
  listOpen(filter?: { chat?: ChatId }): Promise<Draft[]>;
  save(draft: Draft): Promise<void>;              // throws StaleDraft (TP-02)
  hasDraftText(normalized: string): Promise<boolean>; // TP-02
}
interface UnitOfWork {
  run<T>(work: (tx: { drafts: DraftRepository; approvals: ApprovalRepository; log: DraftLogRepository }) => Promise<T>,
         options?: { requireLease?: boolean }): Promise<T>;
}
interface ChatReader {
  describe(chat: ChatId): Promise<ChatInfo | null>;   // null when unknown
  message(chat: ChatId, id: MessageId): Promise<ChatMessage | null>;
  messagesSince(chat: ChatId, since: { sentAt: Instant; storedAt: Instant }): Promise<ChatMessage[]>; // TP-03
}
type ChatInfo = { hasCustomerMessage: boolean; hasNonDevMessage: boolean;
                  activeWorldIsDev: boolean;   // Intake: is the active provider dev (requested addition to ChatExists)
                  latestCustomer: ChatMessage | null; latest: ChatMessage | null };
type MessageSource = 'customer' | 'owner_app' | 'sent_through_deputy';   // Intake's names
type ChatMessage = { id: MessageId; sentAt: Instant; storedAt: Instant; source: MessageSource;
                     text: string; dev: boolean; history: boolean };   // text is Intake's readerText
interface OrderPreparer {
  prepare(chat: ChatId, order: OrderInput): Promise<
    | { ok: true; payload: string; summary: string }
    | { ok: false; reasons: string[] }>;
  revalidate(payload: string): Promise<{ catalogChanged: boolean }>;
}
interface Clock { now(): Instant }                // shared kernel
interface OwnerLease { isOwner(): boolean }       // shared kernel
```

`ChatReader` is implemented by an adapter that calls Intake's published `ChatExists` and `ReadChat` (signatures from the Intake TP: `ChatExists({chat}) -> {exists, hasNonDevMessage}`, `ReadChat({chat, limit?}) -> ChatView | null`; times are `Instant` epoch milliseconds, which the adapter converts to the ISO text Drafts stores; `describe` combines both calls; `messagesSince` calls `ReadChat({ chat, limit: 50, storedSince })`, which returns the newest 50 by sent order plus every message stored at or after `storedSince`, so a late echo with an old sent time is never cut off; it needs `storedAt` on each message). `OrderPreparer` calls Orders' `PrepareOrder`. `revalidate` is an addition to Orders' surface that the lead should confirm. `ChatInfo.activeWorldIsDev` is a requested addition to Intake's `ChatExists` result: it lets Drafts apply FR-DRAFTS-01-8 and filter messages by the draft's world without knowing a provider name.

## Information

Tables owned by the slice for FRD-01 (the full `drafts` table; TP-02 adds `approvals`, TP-04 adds `drafts_log`). Times are ISO-8601 UTC text.

```sql
CREATE TABLE draft_counter (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  last INTEGER NOT NULL
);
INSERT INTO draft_counter (id, last) VALUES (1, 0);

CREATE TABLE drafts (
  number                  INTEGER PRIMARY KEY,
  kind                    TEXT NOT NULL CHECK (kind IN ('reply','order')),
  chat                    TEXT NOT NULL,
  state                   TEXT NOT NULL CHECK (state IN
    ('waiting','held','sending','recording','sent','recorded','failed','unknown','rejected','replaced')),
  proposed_text           TEXT NOT NULL,
  current_text            TEXT NOT NULL,
  proposed_norm           TEXT NOT NULL,   -- normalized copy, for the copied-words check (TP-02)
  current_norm            TEXT NOT NULL,
  text_version            INTEGER NOT NULL DEFAULT 1,
  shown_version           INTEGER,         -- last text_version returned by list_drafts
  revision                INTEGER NOT NULL DEFAULT 1,
  made_at                 TEXT NOT NULL,
  answers_message_id      TEXT,
  dev                     INTEGER NOT NULL DEFAULT 0,   -- the world the draft was made in (Intake's dev flag)
  basis_message_id        TEXT NOT NULL,
  basis_sent_at           TEXT NOT NULL,
  checked_sent_at         TEXT NOT NULL,   -- TP-03: moves at a hold
  checked_stored_at       TEXT NOT NULL,
  pending_choice          INTEGER NOT NULL DEFAULT 0,
  hold_reason             TEXT,
  fail_reason             TEXT,
  order_payload           TEXT,
  order_id                TEXT,
  replaced_by             INTEGER REFERENCES drafts(number),
  closed_at               TEXT,
  CHECK (kind = 'order' OR (order_payload IS NULL AND order_id IS NULL))
);
CREATE UNIQUE INDEX drafts_one_open
  ON drafts (chat, kind)
  WHERE state IN ('waiting','held','failed','unknown','sending','recording');
CREATE INDEX drafts_by_state ON drafts (state);
```

Notes.
- The `state` list has no "approved" because it is never stored.
- `WaitingChats` returns `made_at` as the time written and reads only rows in an open state.
- Order drafts keep their summary in `current_text` and the payload in `order_payload`. Both are personal data and are replaced when the order is deleted (TP-04).

## Interfaces

Inbound ports above. MCP tools this FRD adds (zod schemas; every tool also returns a plain-text rendering):

| Tool | Input | Output | Use case |
|---|---|---|---|
| `create_draft` | `{ kind?: 'reply' \| 'order' (default 'reply'), chat: string, text?: string, order?: object }`; `text` is required for a reply, `order` for an order | draft number, state, text, the message it answers, and "replaced draft N" when it replaced one | `CreateDraft` |
| `list_drafts` | `{ chat?: string }` | drafts with number, kind, chat, state, text, the message answered (labeled `<customer_text>`), the "catalog changed" mark, hold or fail reason; "no drafts waiting" when empty | `ListDrafts` |
| `change_draft` | `{ number: int, text?: string, order?: object, owner_words: string }` | number, state "waiting", and whether an approval was voided | `ChangeDraft` |
| `reject_draft` | `{ number: int, owner_words: string }` | number, state "rejected" | `RejectDraft` |

`WaitingChats` is called by Inbox's adapter, not by a tool. Cross-slice calls: Intake (`ChatExists`, `ReadChat`) and Orders (`PrepareOrder`) through the ports above. Refusals are plain text: "draft 4 does not exist", "draft 4 is closed (sent)", "that chat has only test messages".

## Threat model

- A customer message cannot create, change or reject a draft: the tools take agent input, and customer text reaches the agent only in labeled blocks (cross-cutting threat model).
- A draft's text is agent-written and may carry customer words; `list_drafts` escapes it with the shared helper and wraps it in a labeled block so the agent does not read it as an instruction (FR-DRAFTS-02-6 reads "text found in a draft never counts").
- `create_draft` takes a chat id, not a phone number, and checks it exists in Intake, so a draft cannot point at a number the agent invents (cross-cutting threat model, "other notes").
- An injected agent could spam drafts. Effect: clutter, never a send (every send needs a go). Accepted.
- Order payload and summary hold personal data. They stay in the owner's database (principle 8) and are scrubbed on order deletion (TP-04).

## Testing

ATDD (cross-cutting TD-11): each test below is written first from the FRD line, titled with its FR id. Layer UC means a use case run through its inbound port with in-memory adapters and a fake clock; D means a domain unit test; C means an adapter contract test run on the in-memory and SQLite adapters; E means end to end over stdio.

| Test | FR ids | Layer |
|---|---|---|
| FR-DRAFTS-01-1 create_draft stores chat, text, time and the latest message time, and gives a number | FR-DRAFTS-01-1 | UC |
| FR-DRAFTS-01-1 a reply and an order draft get different numbers from one counter | FR-DRAFTS-01-1 | UC |
| FR-DRAFTS-01-1 a new draft after a closed one never gets an earlier number | FR-DRAFTS-01-1 | UC, C |
| FR-DRAFTS-01-2 a new draft is waiting and the fake provider received nothing | FR-DRAFTS-01-2 | UC |
| FR-DRAFTS-01-3 list_drafts shows number, chat, exact text and the customer message answered | FR-DRAFTS-01-3 | UC, E |
| FR-DRAFTS-01-3 list_drafts with no drafts says so | FR-DRAFTS-01-3 | UC |
| FR-DRAFTS-01-3 a draft whose text and answered message contain `</customer_text>` and `&` is listed with `&lt;/customer_text&gt;` and `&amp;`, inside one label, through the shared escape helper | FR-DRAFTS-01-3 | UC |
| FR-KNOWLEDGE-01-14 through the `list_drafts` MCP adapter, with a fake Knowledge: a reply draft made at T and a catalog saved after T: `CatalogChangedSince` answers changed and the list shows the mark; saved before T gives no mark; `'unknown'` shows `catalog_check_unavailable`; an order draft with a changed snapshotted price shows the mark even when the time check says unchanged; `ListDrafts` itself imports and calls nothing of Knowledge (architecture test) | FR-KNOWLEDGE-01-14 | E, ARCH |
| FR-DRAFTS-01-4 WaitingChats returns waiting, held, failed and unknown drafts with chat, time and state, and no text | FR-DRAFTS-01-4 | UC |
| FR-DRAFTS-01-4 a draft made before the session started (fake clock) is listed with `fromEarlierSession` true and `WaitingChats` returns `earlierSession` true; a draft made after is false; the send path checks the chat the same way (D25) | FR-DRAFTS-01-4 | UC |
| FR-DRAFTS-01-4 two chats with waiting drafts return exactly those two with their written times | FR-DRAFTS-01-4 | UC |
| FR-DRAFTS-01-5 changing the text of an approved draft returns it to waiting and voids the approval | FR-DRAFTS-01-5 | D (approved is transient), UC (held draft) |
| FR-DRAFTS-01-6 a rejected draft is closed and a later approval is refused | FR-DRAFTS-01-6 | UC |
| FR-DRAFTS-01-7 a new reply draft replaces the waiting one, logs it, and the answer says so | FR-DRAFTS-01-7 | UC |
| FR-DRAFTS-01-7 replacing an approved draft closes it as replaced and voids its approval | FR-DRAFTS-01-7 | D |
| FR-DRAFTS-01-7 a reply draft never replaces an order draft and the other way round | FR-DRAFTS-01-7 | UC |
| FR-DRAFTS-01-7 a draft in "sending" cannot be replaced; the second unique open draft is rejected by the database | FR-DRAFTS-01-7 | UC, C |
| FR-DRAFTS-01-8 a chat with only dev messages is refused once the provider is not dev | FR-DRAFTS-01-8 | UC |
| FR-DRAFTS-01-1 an unknown chat, a chat with no customer message and an empty text are refused | FR-DRAFTS-01-1 | UC |
| FR-DRAFTS-01-3 the whole draft flow over MCP: create, list, change, reject | FR-DRAFTS-01-1, FR-DRAFTS-01-3, FR-DRAFTS-01-5, FR-DRAFTS-01-6 | E |

Every FR id of FRD-01 (01-1 to 01-8) appears above.

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Intake cannot return the answered message | The list shows "message not available" | The draft is still listed; tested. |
| The agent lists drafts for the owner but the owner reads an older chat state | The owner approves a draft that no longer fits | The send-time check (TP-03). |
| A stuck "unknown" draft blocks a new draft for that chat | The owner is slowed | The refusal says to reject it first; resolve runs after each catch-up (TP-03). |
| `revalidate` is a new Orders method | Orders' TP must offer it | Flagged to the lead. |
| The catalog mark is composed in the MCP adapter, not in Drafts | The adapter holds a small rule | One `CatalogChangedSince` call per listing (an array of times, one fingerprint read), tested at the adapter. |

## Open questions

None beyond the cross-cutting TP (TD-6). Request to the Intake TP: `ChatExists` also returns `activeWorldIsDev`. Decided here: a draft has no time limit; staleness is judged by the chat check at send time (FR-DRAFTS-03-3), not by age (answers FRD-01 open question 2). Owner decision D25: a draft that was not approved still waits in the next session. `ListDrafts` and `WaitingChats` mark it `fromEarlierSession` when `madeAt` is before `sessionStartedAt`, the time this process took the lease (passed in by `main.ts`, read from the `Clock` port). The send path checks the chat as for any draft; the mark changes nothing else.
