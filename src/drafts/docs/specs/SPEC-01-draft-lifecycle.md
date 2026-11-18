# Spec: Draft lifecycle (Drafts FRD-01)

Status: Approved (2026-11-18)

One per FRD, resting on [TP-01](../tp/TP-01-draft-lifecycle.md). It decides nothing new: where TP-01 is silent, the choices listed under Context settle it (L9).

## Context

- FRD: [FRD-01](../frd/FRD-01-draft-lifecycle.md). TP: [TP-01](../tp/TP-01-draft-lifecycle.md). ADRs: ADR-001 (draft numbering), ADR-002 (answered message reference), and cross-slice ADR-000, ADR-009, ADR-010, ADR-011 in `docs/adr/`.
- Build order inside Drafts: SPEC-01 Task 1 (the domain), then SPEC-04 Task 1 (the log core without SQLite: `LogEntry`, `NewLogEntry`, `toLogEntries`, `DraftLogRepository`, the in-memory log), then SPEC-01 Task 2, then SPEC-04 Task 2 (the SQLite log, `0002-log.sql` and the `log` member of both units of work; it follows SPEC-01 Task 2 because `drafts_log` has a foreign key to `drafts`), then SPEC-01 Tasks 3 to 7, then SPEC-02, SPEC-03, and SPEC-04 Tasks 3 to 7. Every use case appends log entries in its unit of work, so the log must exist before the use cases. Each later spec that adds a `DraftEvent` member also adds its case to `toLogEntries`, whose exhaustive switch fails the typecheck until it exists.
- Already built by Intake's SPEC-01 and SPEC-02 (the foundation). This spec imports them and never redefines them. From `src/shared/`, one file each: `Instant` (`instant.ts`, epoch milliseconds, a number), `ChatId` and `parseChatId` (`chat-id.ts`), `MessageId` and `messageIdKey` (`message-id.ts`, an object `{ provider, providerMessageId }`; `messageIdKey` gives the text `provider:providerMessageId`), `Source` (`source.ts`), `SendId` and `parseSendId` (`send-id.ts`), `Clock` (`clock.ts`: `now()`, `sleep(ms)`), `OwnerLease` (`owner-lease.ts`: `isOwner(within?): Promise<boolean>`), `SqlDatabase` and `SqlExecutor` (`sql-database.ts`: `query`, `run`, `transaction`), and `normalizeText`, `wholeNumberTokens` (`text.ts`). From the adapters: `src/adapters/sqlite/row.ts` (`str`, `strOrNull`, `num`, `numOrNull`, `flag`), `src/adapters/mcp/tool.ts` (`defineTool`, `ToolDefinition`, `ToolResult`), `src/adapters/mcp/customer-text.ts` (`customerText(label, text)`), the migration list in `src/main.ts`. From the tests: `test/support/fake-clock.ts` (`FakeClock`, with `advance(ms)`), `test/support/in-memory-owner-lease.ts`, `test/support/harness.ts` (`startServer(env)`, `call`), `test/architecture/architecture.test.ts` and `test/architecture/imports.ts` (`listImports`).
- Intake ports called here, as TP-01 states them: `ChatExists({chat}) -> {exists, hasNonDevMessage, activeWorldIsDev}` and `ReadChat({chat, limit?, storedSince?}) -> ChatView | null` (messages carry `sentAt`, `storedAt`, `source`, `history`, `dev`, `readerText`). Intake's ports are objects with `execute(query)`.
- Orders has no spec. Drafts owns `OrderPreparer` as defined below and ships an in-memory fake. The real Orders adapter is out of scope.
- Conventions (ADR-000, ADR-010): Bun, `bun:test`. `domain/`, `application/`, `ports/` import no package and no `bun:` or `node:` module. `bun:sqlite` appears only in the foundation's `SqlDatabase` adapter, so Drafts' SQLite repositories use `SqlDatabase` only.
- Times inside Drafts' domain are `Instant`. The SQLite repository stores ISO-8601 UTC text (TP-01 Information) and converts with `toIso` and `fromIso` in `domain/time.ts`.

Choices this spec makes where TP-01 is silent (L9): `answers` is a `MessageId | null`; `retry_at` and `attempts` are columns of `0001-drafts.sql`; `ChangeDraft` and `RejectDraft` parse the owner's words with the shared `parseOwnerWords` (1 to 1,000 characters after trimming) and refuse `words_empty`, so no empty words are stored; a missing field on `change_draft` is `wrong_kind`.

## Files

| Path | Change | Holds |
|---|---|---|
| `src/drafts/domain/time.ts` | create | `toIso`, `fromIso` |
| `src/drafts/domain/draft.ts` | create | `Draft` aggregate, `DraftKind`, `DraftState`, `DraftNumber`, `MessageMark`, `DraftSnapshot` |
| `src/drafts/domain/approval.ts` | create | `Approval` type (the live approval field of `Draft`; SPEC-02 fills it) |
| `src/drafts/domain/events.ts` | create | `DraftEvent` union |
| `src/drafts/domain/errors.ts` | create | `StaleDraft`, `LeaseLost`, `LogUnavailable` error classes thrown by adapters |
| `src/drafts/domain/refusals.ts` | create | `Refusal` union and `refusalText` |
| `src/drafts/ports/inbound.ts` | create | use-case interfaces and result types of this spec |
| `src/drafts/ports/outbound.ts` | create | `DraftRepository`, `UnitOfWork`, `ChatReader`, `OrderPreparer` and their types |
| `src/drafts/application/create-draft.ts` | create | `CreateDraft` |
| `src/drafts/application/list-drafts.ts` | create | `ListDrafts` |
| `src/drafts/application/change-draft.ts` | create | `ChangeDraft` |
| `src/drafts/application/reject-draft.ts` | create | `RejectDraft` |
| `src/drafts/application/waiting-chats.ts` | create | `WaitingChats` |
| `src/drafts/adapters/memory/in-memory-drafts.ts` | create | in-memory `DraftRepository` and `UnitOfWork` (one shared store) |
| `src/drafts/adapters/memory/fake-chat-reader.ts` | create | `FakeChatReader` |
| `src/drafts/adapters/memory/fake-order-preparer.ts` | create | `FakeOrderPreparer` |
| `src/drafts/adapters/sqlite/sqlite-draft-repository.ts` | create | `SqliteDraftRepository` over `SqlDatabase` |
| `src/drafts/adapters/sqlite/sqlite-unit-of-work.ts` | create | `SqliteUnitOfWork` |
| `src/drafts/adapters/sqlite/draft-row.ts` | create | row to `DraftSnapshot` mapping |
| `src/drafts/adapters/sqlite/migrations/0001-drafts.sql` | create | `draft_counter`, `drafts` |
| `src/drafts/adapters/intake/intake-chat-reader.ts` | create | `ChatReader` over Intake's `ChatExists` and `ReadChat` |
| `src/drafts/index.ts` | create | published surface: inbound port types, event types, `createDrafts(deps)` |
| `src/drafts/adapters/mcp/drafts-tools.ts` | create | tools `create_draft`, `change_draft`, `reject_draft` |
| `src/composition/mcp/list-drafts-tool.ts` | create | tool `list_drafts`, which composes Drafts and Knowledge; only `src/main.ts` imports `src/composition/mcp/` |
| `src/main.ts` | change | build the Drafts adapters and use cases; add `0001-drafts.sql` to the migration list |
| `test/drafts/unit/draft.test.ts` | create | `Draft` rules |
| `test/drafts/contract/draft-repository.contract.ts` | create | shared contract (a function that takes a factory) |
| `test/drafts/contract/draft-repository.memory.test.ts` | create | contract on the in-memory adapter |
| `test/drafts/contract/draft-repository.sqlite.test.ts` | create | contract on SQLite |
| `test/drafts/contract/intake-chat-reader.test.ts` | create | adapter test against fake Intake ports |
| `test/drafts/acceptance/harness.ts` | create | `makeDrafts()` builds the use cases over in-memory adapters, `FakeClock`, `InMemoryOwnerLease` |
| `test/drafts/acceptance/create-draft.test.ts` | create | CreateDraft |
| `test/drafts/acceptance/list-and-waiting.test.ts` | create | ListDrafts and WaitingChats |
| `test/drafts/acceptance/change-and-reject.test.ts` | create | ChangeDraft and RejectDraft |
| `test/drafts/acceptance/drafts-mcp.e2e.test.ts` | create | tools over stdio, and the catalog mark composition |
| `test/architecture/drafts-rules.test.ts` | create | Drafts-specific import rules |

## Interfaces

`src/drafts/domain/time.ts`:

```ts
import type { Instant } from "../../shared/instant";
export const toIso = (at: Instant): string => new Date(at).toISOString();
export const fromIso = (text: string): Instant => Date.parse(text);
```

`src/drafts/domain/draft.ts`:

```ts
import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { MessageId } from "../../shared/message-id";
import type { Approval } from "./approval";
import type { DraftEvent } from "./events";

export type DraftKind = "reply" | "order";
export type DraftNumber = number; // integer >= 1, given by DraftRepository.nextNumber
export type DraftState =
  | "waiting" | "held" | "sending" | "recording"
  | "sent" | "recorded" | "failed" | "unknown" | "rejected" | "replaced";
export const OPEN_STATES: readonly DraftState[] =
  ["waiting", "held", "failed", "unknown", "sending", "recording"];
export const CLOSED_STATES: readonly DraftState[] = ["sent", "recorded", "rejected", "replaced"];
export type MessageMark = { readonly messageId: MessageId; readonly sentAt: Instant };
export type Mark = { readonly sentAt: Instant; readonly storedAt: Instant };

export interface DraftSnapshot {
  readonly number: DraftNumber;
  readonly kind: DraftKind;
  readonly chat: ChatId;
  readonly state: DraftState;
  readonly proposedText: string;      // verbatim, never trimmed or reformatted
  readonly currentText: string;       // verbatim
  readonly proposedNorm: string;      // normalizeText(proposedText), for the copied-words check
  readonly currentNorm: string;
  readonly textVersion: number;       // 1 at creation, +1 on each text change
  readonly shownVersion: number | null;
  readonly revision: number;          // 1 at creation; the repository raises it on each save
  readonly madeAt: Instant;
  readonly dev: boolean;              // the world the draft was made in
  readonly answers: MessageId | null; // replies only: the customer message answered
  readonly basis: MessageMark;        // latest message of the chat when the draft was made
  readonly checkedThrough: Mark;      // moves at a hold (SPEC-03)
  readonly pendingChoice: boolean;    // SPEC-03
  readonly holdReason: string | null; // reason codes joined by ","
  readonly failReason: string | null;
  readonly orderPayload: string | null;
  readonly orderId: string | null;
  readonly replacedBy: DraftNumber | null;
  readonly closedAt: Instant | null;
  readonly retryAt: Instant | null;   // SPEC-03
  readonly attempts: number;          // SPEC-03
  readonly approval: Approval | null; // the live approval; never stored in the drafts row
}

export type DraftChange =
  | { readonly ok: true; readonly events: readonly DraftEvent[] }
  | { readonly ok: false; readonly reason: "closed" | "in_flight" | "unknown_open" | "empty_text" };

export class Draft {
  private constructor(private s: DraftSnapshot);
  static propose(input: {
    number: DraftNumber; kind: DraftKind; chat: ChatId; text: string; now: Instant; dev: boolean;
    answers: MessageId | null; basis: MessageMark; checkedStoredAt: Instant;
    orderPayload: string | null;
  }): { draft: Draft; events: readonly DraftEvent[] } | { ok: false; reason: "empty_text" };
  static rehydrate(snapshot: DraftSnapshot): Draft;
  snapshot(): DraftSnapshot;
  /** waiting, held or failed only. Sets "waiting", raises textVersion, clears shownVersion, voids a live approval. */
  changeText(input: { text: string; orderPayload: string | null; ownerWords: string; now: Instant }): DraftChange;
  /** waiting, held, failed or unknown. Sets "rejected", closes it, voids a live approval. */
  reject(input: { ownerWords: string; now: Instant }): DraftChange;
  /** waiting, held or failed. Sets "replaced", closes it, voids a live approval. */
  replaceBy(input: { number: DraftNumber; now: Instant }): DraftChange;
  /** Sets shownVersion to textVersion. Returns false when it was already so. */
  markShown(): boolean;
}
```

Rules of `Draft` (TP-01 invariants):
- `propose` refuses text that is empty after trimming. The stored text is the input, byte for byte.
- A draft in "sending" or "recording" refuses `changeText`, `reject` and `replaceBy` with reason `in_flight`. A draft in "unknown" refuses `changeText` and `replaceBy` with `unknown_open`. A closed draft refuses everything with `closed`.
- `changeText` on an order draft takes the new summary as `text` and the new payload as `orderPayload`.
- The number never changes.

`src/drafts/domain/approval.ts` (SPEC-02 adds the behavior; this spec only needs the type):

```ts
import type { DraftNumber } from "./draft";
import type { Instant } from "../../shared/instant";
export interface Approval {
  readonly id: string;
  readonly draftNumber: DraftNumber;
  readonly textVersion: number;
  readonly text: string;
  readonly textHash: string;
  readonly ownerWords: string;
  readonly approvedAt: Instant;
  readonly usedAt: Instant | null;
  readonly sendId: string;
  readonly voidedAt: Instant | null;
  readonly voidReason: string | null;
}
```

`src/drafts/domain/events.ts`:

```ts
import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { DraftKind, DraftNumber } from "./draft";

type Base = { readonly draft: DraftNumber; readonly draftKind: DraftKind; readonly chat: ChatId; readonly at: Instant };
export type DraftEvent =
  | (Base & { readonly type: "DraftProposed"; readonly text: string; readonly answersMessageId: string | null })
  | (Base & { readonly type: "DraftReplaced"; readonly replacedBy: DraftNumber })
  | (Base & { readonly type: "TextChanged"; readonly proposedText: string; readonly newText: string; readonly ownerWords: string })
  | (Base & { readonly type: "DraftRejected"; readonly ownerWords: string })
  | (Base & { readonly type: "ApprovalVoided"; readonly reason: "changed" | "replaced" | "rejected" | "held"; readonly approvalId: string });
```

SPEC-02 and SPEC-03 add members to this union.

`src/drafts/domain/errors.ts`:

```ts
export class StaleDraft extends Error { constructor(readonly draft: number) { super(`draft ${draft} changed`); } }
export class LeaseLost extends Error { constructor() { super("lease lost"); } }
export class LogUnavailable extends Error { constructor(cause?: unknown) { super("drafts log unavailable", { cause }); } }
```

`src/drafts/domain/refusals.ts`:

```ts
import type { DraftState } from "./draft";
export type Refusal =
  | { readonly code: "not_owner" }
  | { readonly code: "chat_not_found" }
  | { readonly code: "no_customer_message" }
  | { readonly code: "dev_messages_only" }
  | { readonly code: "empty_text" }
  | { readonly code: "order_rejected"; readonly reasons: readonly string[] }
  | { readonly code: "send_in_progress"; readonly number: number }
  | { readonly code: "outcome_unknown_open"; readonly number: number }
  | { readonly code: "draft_not_found"; readonly number: number }
  | { readonly code: "draft_closed"; readonly number: number; readonly state: DraftState }
  | { readonly code: "wrong_kind"; readonly number: number }
  | { readonly code: "words_empty" }
  | { readonly code: "log_unavailable" }
  | { readonly code: "stale_draft"; readonly number: number };
/** English default text for each code (D20). Exhaustive switch; no customer or provider text. */
export function refusalText(r: Refusal): string;
```

Default texts: `not_owner` "another Deputy session owns this data"; `chat_not_found` "that chat does not exist"; `no_customer_message` "that chat has no customer message"; `dev_messages_only` "that chat has only test messages"; `words_empty` "the owner's words are empty or longer than 1000 characters"; `empty_text` "the draft text is empty"; `order_rejected` "the order was refused: " plus the reasons joined by "; "; `send_in_progress` "draft N is being sent"; `outcome_unknown_open` "draft N has an unknown outcome: reject it first, or wait for it to resolve"; `draft_not_found` "draft N does not exist"; `draft_closed` "draft N is closed (STATE)"; `wrong_kind` "draft N is of the other kind"; `log_unavailable` "the drafts log cannot be written, so nothing was done"; `stale_draft` "draft N changed while this ran; list the drafts and try again".

`src/drafts/ports/outbound.ts` (this spec's part; SPEC-02 and SPEC-03 add the rest):

```ts
import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { MessageId } from "../../shared/message-id";
import type { Draft, DraftKind, DraftNumber, MessageMark } from "../domain/draft";
import type { DraftLogRepository } from "./log"; // SPEC-04 Task 1

export type OrderInput = Readonly<Record<string, unknown>>; // validated by Orders' PrepareOrder

export interface DraftRepository { // every method runs inside UnitOfWork.run
  nextNumber(): Promise<DraftNumber>;
  get(number: DraftNumber): Promise<Draft | null>;
  openFor(chat: ChatId, kind: DraftKind): Promise<Draft | null>;
  listOpen(filter?: { chat?: ChatId }): Promise<Draft[]>;
  /** Insert when the number is new. Otherwise compare-and-set on draft.snapshot().revision and store revision + 1.
   *  The object passed is not changed. Throws StaleDraft when the stored revision differs. */
  save(draft: Draft): Promise<void>;
  /** SPEC-02 adds hasDraftText. */
}

export interface UnitOfWork {
  run<T>(
    work: (tx: { drafts: DraftRepository }) => Promise<T>,
    options?: { requireLease?: boolean }, // default true: a write checks the lease; pure reads pass false
  ): Promise<T>; // commits when work resolves; rolls back and rethrows when it throws; transactions run one at a time
}
// SPEC-04 Task 2 adds `log: DraftLogRepository` to the tx object and SPEC-02 adds `approvals: ApprovalRepository`.

export type ChatMessage = {
  readonly id: MessageId; readonly sentAt: Instant; readonly storedAt: Instant;
  readonly source: "customer" | "owner_app" | "sent_through_deputy";
  readonly text: string; readonly dev: boolean; readonly history: boolean; // text is Intake's readerText
};
export type ChatInfo = {
  readonly hasCustomerMessage: boolean; readonly hasNonDevMessage: boolean;
  readonly activeWorldIsDev: boolean;
  readonly latestCustomer: ChatMessage | null; readonly latest: ChatMessage | null;
};
export interface ChatReader {
  describe(chat: ChatId): Promise<ChatInfo | null>;               // null when the chat is unknown
  message(chat: ChatId, id: MessageId): Promise<ChatMessage | null>;
  /** SPEC-03 adds messagesSince. */
}

export interface OrderPreparer { // Drafts owns this port; the adapter calls Orders' PrepareOrder and revalidate
  prepare(chat: ChatId, order: OrderInput): Promise<
    | { ok: true; payload: string; summary: string }
    | { ok: false; reasons: string[] }>;
  revalidate(payload: string): Promise<{ catalogChanged: boolean }>;
}
```

`src/drafts/ports/inbound.ts` (this spec's part):

```ts
import type { DraftKind, DraftNumber, DraftState } from "../domain/draft";
import type { Refusal } from "../domain/refusals";
import type { OrderInput } from "./outbound";

export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly refusal: Refusal };

export type MessageView = { id: string; sentAt: string; text: string; source: "customer" | "owner_app" | "sent_through_deputy" };

export interface CreateDraft {
  run(input:
    | { kind: "reply"; chat: string; text: string }
    | { kind: "order"; chat: string; order: OrderInput }): Promise<Outcome<CreateDraftResult>>;
}
export type CreateDraftResult = {
  number: number; kind: DraftKind; state: "waiting";
  chat: ChatId; madeAt: Instant;      // FR-DRAFTS-01-1: the chat and the time the draft was made
  text: string;                       // exactly what would be sent (order: Orders' summary)
  answers: MessageView | null;
  replaced: { number: number; state: "waiting" | "held" | "failed" } | null;
};

export interface ListDrafts { run(input: { chat?: string }): Promise<Outcome<DraftView[]>>; }
export type DraftView = {
  number: number; kind: DraftKind; chat: string; state: DraftState;
  text: string; madeAt: string; answers: MessageView | { unavailable: true } | null;
  catalogChanged: boolean;            // orders only; replies are marked by the MCP adapter
  holdReason: string | null; failReason: string | null;
  fromEarlierSession: boolean;        // madeAt is before sessionStartedAt (D25)
  retryAt: string | null;             // SPEC-03
};

export interface ChangeDraft {
  run(input: { number: number; text?: string; order?: OrderInput; ownerWords: string }): Promise<Outcome<ChangeDraftResult>>;
}
export type ChangeDraftResult = { number: number; state: "waiting"; approvalVoided: boolean };

export interface RejectDraft {
  run(input: { number: number; ownerWords: string }): Promise<Outcome<{ number: number; state: "rejected" }>>;
}

export interface WaitingChats { run(): Promise<WaitingChat[]>; } // a pure read: no lease check
export type WaitingChat = {
  number: number; kind: DraftKind; chat: string; writtenAt: string;
  state: "waiting" | "held" | "failed" | "unknown";
  earlierSession: boolean;
};
// "sending" and "recording" are reported as "waiting". No draft text is returned.
```

Use case rules (TP-01 flows):
- `CreateDraft.run`: lease check first (`not_owner`). Reply: empty text after trimming is `empty_text`. Read `Clock.now()` into `checkedStoredAt`, then `ChatReader.describe`. Order: `OrderPreparer.prepare` (a refusal is `order_rejected`). Then one `UnitOfWork.run(..., { requireLease: true })`: `openFor(chat, kind)`; `sending` or `recording` gives `send_in_progress`, `unknown` gives `outcome_unknown_open`; `nextNumber`; `Draft.propose`; save the replaced draft first (`replaceBy`), then the new one, because the unique open index allows one open draft per `(chat, kind)`; append the log entries of every event. A reply draft has `answers = describe().latestCustomer`; an order draft has `answers = null`. `basis` is `describe().latest`. `dev` is `describe().activeWorldIsDev`.
- Refusal order for the chat: unknown chat is `chat_not_found`; then `!activeWorldIsDev && !hasNonDevMessage` is `dev_messages_only`; then no customer message is `no_customer_message`. The dev check comes first because the real ChatReader counts only the active world's messages, so a dev-only chat under a real provider also has no customer message and `dev_messages_only` would never be reached.
- `ListDrafts.run`: lease check (it writes the shown mark). One `UnitOfWork.run`: `listOpen`, `markShown` on each draft where it returns true, `save` those. Then read each answered message through `ChatReader.message` (null gives `{ unavailable: true }`). For an order draft, `OrderPreparer.revalidate(payload)` sets `catalogChanged`. `sessionStartedAt: Instant` is a dependency of the factory. The use case wraps no text; the MCP adapter wraps and escapes.
- `ChangeDraft.run`: lease check; `parseOwnerWords(ownerWords)`, null is `words_empty`; load; map `DraftChange` failures: `closed` to `draft_closed`, `in_flight` to `send_in_progress`, `unknown_open` to `outcome_unknown_open`. A `text` on an order draft or an `order` on a reply draft, or neither, is `wrong_kind`. A reply with blank text is `empty_text`. An order draft calls `OrderPreparer.prepare` again (a refusal is `order_rejected`) and stores the new summary and payload. `approvalVoided` is true when the events hold an `ApprovalVoided`.
- `RejectDraft.run`: lease check; `parseOwnerWords(ownerWords)`, null is `words_empty`; load; same mapping. `unknown` drafts can be rejected.
- Every use case that appends log entries returns `log_unavailable` when the unit of work throws `LogUnavailable`, and `stale_draft` when it throws `StaleDraft`. `LeaseLost` is `not_owner`.

`src/drafts/index.ts`:

```ts
export type { CreateDraft, ListDrafts, ChangeDraft, RejectDraft, WaitingChats /* and the result types */ } from "./ports/inbound";
export type { DraftEvent } from "./domain/events";
export interface DraftsDeps {
  clock: Clock; lease: OwnerLease; sessionStartedAt: Instant;
  unitOfWork: UnitOfWork; chats: ChatReader; orders: OrderPreparer;
}
export function createDrafts(deps: DraftsDeps): {
  createDraft: CreateDraft; listDrafts: ListDrafts; changeDraft: ChangeDraft;
  rejectDraft: RejectDraft; waitingChats: WaitingChats;
};
```

SPEC-02, SPEC-03 and SPEC-04 add dependencies and members to `DraftsDeps` and the returned object.

MCP tools in `src/drafts/adapters/mcp/drafts-tools.ts` (each slice writes its own tools, Intake SPEC-01, MCP structure): `draftsTools(u: { createDraft: CreateDraft; changeDraft: ChangeDraft; rejectDraft: RejectDraft }): ToolDefinition[]`, built with `defineTool`. It holds no `list_drafts`: a tool that composes several slices lives in `src/composition/mcp/`. `src/composition/mcp/list-drafts-tool.ts` exports `listDraftsTool(u: { listDrafts: ListDrafts; catalogChangedSince: CatalogChangedSince }): ToolDefinition`, built with `defineTool`. `CatalogChangedSince` is a function type declared in that file, `(since: string[]) => Promise<("changed" | "unchanged" | "unknown")[]>`; it imports Drafts only through `src/drafts/index.ts` and Knowledge only through its index. Only `src/main.ts` imports `src/composition/mcp/`, and it builds the function from Knowledge's `CatalogChangedSince`. The use cases take `chat` as a string and call `parseChatId`; a chat that does not parse is `chat_not_found` for `CreateDraft`, and an empty result for the `chat` filter of `ListDrafts`. Schemas (zod):
- `create_draft`: `{ kind: z.enum(["reply","order"]).default("reply"), chat: z.string().min(1), text: z.string().optional(), order: z.record(z.unknown()).optional() }`. A reply needs `text`, an order needs `order`; otherwise the tool answers with a plain refusal and calls nothing.
- `list_drafts`: `{ chat: z.string().min(1).optional() }`.
- `change_draft`: `{ number: z.number().int().min(1), text: z.string().optional(), order: z.record(z.unknown()).optional(), owner_words: z.string() }`.
- `reject_draft`: `{ number: z.number().int().min(1), owner_words: z.string() }`.
Every tool returns a plain-text rendering and a structured result. Refusals carry `code` and `refusalText`. Customer-derived fields of `list_drafts` (the answered message and the draft text) pass through `customer-text.ts`, each field in its own `<customer_text>` label. `create_draft` labels its text and answered message the same way. After `ListDrafts`, the `list_drafts` handler (in `src/composition/mcp/list-drafts-tool.ts`) calls the injected `catalogChangedSince(since: string[]): Promise<("changed" | "unchanged" | "unknown")[]>` once with every draft's `madeAt`, and sets the mark on a draft when either `catalogChanged` is true or the answer is `"changed"`. The answer `"unknown"` shows the code `catalog_check_unavailable` and no mark. `src/main.ts` builds `catalogChangedSince` from Knowledge's `CatalogChangedSince`. Until Knowledge is wired, `main.ts` passes a function that answers `"unknown"` for every time.

## Data

`src/drafts/adapters/sqlite/migrations/0001-drafts.sql` (TP-01 Information; `retry_at` and `attempts` are the TP-03 columns that TP-03 says `drafts` holds, with times as ISO text like the rest):

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
  proposed_norm           TEXT NOT NULL,
  current_norm            TEXT NOT NULL,
  text_version            INTEGER NOT NULL DEFAULT 1,
  shown_version           INTEGER,
  revision                INTEGER NOT NULL DEFAULT 1,
  made_at                 TEXT NOT NULL,
  answers_message_id      TEXT,
  dev                     INTEGER NOT NULL DEFAULT 0,
  basis_message_id        TEXT NOT NULL,
  basis_sent_at           TEXT NOT NULL,
  checked_sent_at         TEXT NOT NULL,
  checked_stored_at       TEXT NOT NULL,
  pending_choice          INTEGER NOT NULL DEFAULT 0,
  hold_reason             TEXT,
  fail_reason             TEXT,
  order_payload           TEXT,
  order_id                TEXT,
  replaced_by             INTEGER REFERENCES drafts(number) DEFERRABLE INITIALLY DEFERRED,
  closed_at               TEXT,
  retry_at                TEXT,
  attempts                INTEGER NOT NULL DEFAULT 0,
  CHECK (kind = 'order' OR (order_payload IS NULL AND order_id IS NULL))
);
CREATE UNIQUE INDEX drafts_one_open
  ON drafts (chat, kind)
  WHERE state IN ('waiting','held','failed','unknown','sending','recording');
CREATE INDEX drafts_by_state ON drafts (state);
```

Row mapping: `answers_message_id` and `basis_message_id` hold `messageIdKey(id)`, and the row mapper parses it back by splitting at the first colon and checking that the first part is a `ProviderName`; the row mapper is the one place a cast is allowed, after that check. The table has no column for the sent time of the answered message, so `DraftSnapshot.answers` is a `MessageId | null` (L7: TP-01 names it `MessageMark | null`, but only the id is stored). `basis` keeps its sent time in `basis_sent_at`.

`nextNumber` runs `UPDATE draft_counter SET last = last + 1 WHERE id = 1 RETURNING last` inside the unit of work (TD-1 of TP-01, so a rolled-back transaction rolls the number back). The in-memory adapter keeps a counter and restores it on rollback.

## Tasks

### Task 1: The `Draft` aggregate, events, refusals and time helpers
- **Tests first:** `test/drafts/unit/draft.test.ts`, layer D (no I/O).
  - FR-DRAFTS-01-1: Given `Draft.propose` with a reply text that has leading spaces, a line break and no trailing newline, Then `currentText` equals the input byte for byte, `number` equals the input, `textVersion` is 1 and `state` is "waiting". The number stays the same after `changeText`.
  - FR-DRAFTS-01-2: Given a new draft, Then `state` is "waiting" and the only event is `DraftProposed`.
  - FR-DRAFTS-01-5: Given a draft rehydrated with a live `approval` (approved, not yet sent), When `changeText` runs, Then the state is "waiting", `textVersion` rose by 1, `shownVersion` is null, and the events are `TextChanged` then `ApprovalVoided` with reason "changed".
  - FR-DRAFTS-01-6: Given a waiting draft, When `reject` runs, Then the state is "rejected", `closedAt` is set, and every later `changeText`, `reject` and `replaceBy` returns `closed`.
  - FR-DRAFTS-01-7: Given a draft with a live approval, When `replaceBy(7)` runs, Then the state is "replaced", `replacedBy` is 7 and the events are `DraftReplaced` and `ApprovalVoided` with reason "replaced". Given a draft in "sending" or "recording", Then `replaceBy`, `changeText` and `reject` return `in_flight`. Given a draft in "unknown", Then `changeText` and `replaceBy` return `unknown_open` and `reject` succeeds.
  - FR-DRAFTS-01-1: Given empty or whitespace text, Then `propose` returns `empty_text`.
  - Language (D20): Given the exhaustive `refusalText`, Then every `Refusal` code returns a non-empty English text and none contains a customer-supplied string (a unit test iterates a sample of each code).
- **Build:** `src/drafts/domain/{time,draft,approval,events,errors,refusals}.ts` as in Interfaces. `Draft` keeps a `DraftSnapshot` and returns `DraftChange` values. `propose` fills `proposedNorm` and `currentNorm` with `normalizeText`.
- **Done when:** `bun test test/drafts/unit/draft.test.ts` and `bun run typecheck` pass.

### Task 2: Ports, the in-memory store, the repository contract and the SQLite repository
- **Tests first:** `test/drafts/contract/draft-repository.contract.ts` exports `draftRepositoryContract(name, makeUnitOfWork)`. Layer C, run by `draft-repository.memory.test.ts` and `draft-repository.sqlite.test.ts` (SQLite over the foundation's in-memory `SqlDatabase`, with `0001-drafts.sql` applied).
  - FR-DRAFTS-01-1: Given three `nextNumber` calls in three transactions, Then the numbers are 1, 2, 3. Given a transaction that took number 4 and then threw, Then the next call returns 4 again. Given drafts 1 to 3 all closed, Then `nextNumber` returns 4 and never an earlier number.
  - FR-DRAFTS-01-1: A reply draft and an order draft in the same chat get different numbers from the one counter.
  - FR-DRAFTS-01-7: Given an open reply draft in chat A, When a second open reply draft for chat A is saved, Then the save throws (the unique open index; the in-memory adapter reproduces it). An open order draft in the same chat saves.
  - FR-DRAFTS-01-7: Given a draft saved at revision 1, When it is saved twice from the same loaded copy, Then the second `save` throws `StaleDraft`.
  - FR-DRAFTS-01-1: Given a saved draft, When it is read back, Then every `DraftSnapshot` field except `approval` equals what was saved, and the stored text is byte for byte the same (verbatim text).
  - FR-DRAFTS-01-4: `listOpen` returns drafts in states waiting, held, failed, unknown, sending and recording, and none in sent, recorded, rejected or replaced; `listOpen({ chat })` filters by chat.
- **Build:** `ports/outbound.ts` (this spec's part), `ports/inbound.ts` (types only), `adapters/memory/in-memory-drafts.ts` (one store; `run` serializes transactions with a promise chain, copies state at start and restores it on a throw; `requireLease` calls `await lease.isOwner()` and throws `LeaseLost` when it is false), `adapters/sqlite/{draft-row,sqlite-draft-repository,sqlite-unit-of-work}.ts` and the migration file. The SQLite unit of work runs `SqlDatabase.transaction`; with `requireLease` it calls `await lease.isOwner(tx)` inside the transaction and throws `LeaseLost` when it is false. Register the migration in `src/main.ts`.
- **Done when:** `bun test test/drafts/contract` and `bun run typecheck` pass.

### Task 3: `CreateDraft`
- **Tests first:** `test/drafts/acceptance/create-draft.test.ts`, layer UC (in-memory adapters, `FakeChatReader`, `FakeOrderPreparer`, `FakeClock`, `InMemoryOwnerLease`). `FakeChatReader` is built from a list of messages per chat and answers `describe` and `message`; `FakeOrderPreparer` accepts an order with a `fail` key set as a refusal.
  - FR-DRAFTS-01-1: Given a chat with a customer question, When `CreateDraft` runs, Then the result has a number, the chat, the text and the time the draft was made, the stored draft has `basis` equal to the latest message, and `checkedThrough.storedAt` equals the clock value read before `describe` was called (the fake records call order).
  - FR-DRAFTS-01-1: Given a reply draft and an order draft, Then their numbers differ and come from one numbering. Given a closed draft, Then a new draft's number is never lower than an earlier one.
  - FR-DRAFTS-01-1: Given an unknown chat, a chat with no customer message, and an empty text, Then each is refused with `chat_not_found`, `no_customer_message` and `empty_text` and nothing is stored.
  - FR-DRAFTS-01-2: Given the creation, Then the state is "waiting" and the fake provider (a counting fake with no method on `CreateDraft`'s deps) received nothing: the `CreateDraft` dependency list holds no sender, checked by constructing it without one.
  - FR-DRAFTS-01-7: Given a waiting reply draft, When another reply draft is created for the chat, Then the old one is "replaced", the result says `replaced: { number, state: "waiting" }`, and the log (read through the in-memory log repository) has `proposed` and `replaced` entries.
  - FR-DRAFTS-01-7: Given a reply draft and then an order draft for the same chat, Then both stay open. A later reply draft replaces only the reply draft.
  - FR-DRAFTS-01-7: Given an existing draft in "sending" or "recording", Then `CreateDraft` returns `send_in_progress`. Given "unknown", Then `outcome_unknown_open`. Given "held" or "failed", Then it is replaced and the result carries that state.
  - FR-DRAFTS-01-8: Given `activeWorldIsDev` false and a chat whose messages are all dev, When `CreateDraft` runs, Then it returns `dev_messages_only`. Given `activeWorldIsDev` true, Then the same chat is accepted and the draft has `dev` true.
  - FR-DRAFTS-01-1: Given the process does not own the lease, Then `CreateDraft` returns `not_owner` and stores nothing. Given an order whose `OrderPreparer` refuses, Then `order_rejected` carries the reasons. Given a log append that throws `LogUnavailable`, Then the result is `log_unavailable` and the draft is not stored.
- **Build:** `application/create-draft.ts`, `adapters/memory/fake-chat-reader.ts`, `adapters/memory/fake-order-preparer.ts`, `test/drafts/acceptance/harness.ts`.
- **Done when:** `bun test test/drafts/acceptance/create-draft.test.ts` and `bun run typecheck` pass.

### Task 4: `ListDrafts` and `WaitingChats`
- **Tests first:** `test/drafts/acceptance/list-and-waiting.test.ts`, layer UC.
  - FR-DRAFTS-01-3: Given a draft for a chat, When `ListDrafts` runs, Then the view has the number, chat, the exact text and the answered customer message. Given no drafts, Then the value is an empty array.
  - FR-DRAFTS-01-3: Given a draft whose answered message is not in Intake, Then `answers` is `{ unavailable: true }` and the draft is still listed.
  - FR-DRAFTS-01-3: Given `ListDrafts` ran, Then the draft's `shownVersion` equals its `textVersion`. Given `ChangeDraft` ran after, Then `shownVersion` is null.
  - FR-DRAFTS-01-3: Given the process does not own the lease, Then `ListDrafts` returns `not_owner` and writes no mark.
  - FR-DRAFTS-01-4: Given drafts in waiting, held, failed and unknown, When `WaitingChats` runs, Then each comes with chat, time written and state, and no text field exists on the result. A draft in "sending" or "recording" is reported as "waiting". Closed drafts are not returned.
  - FR-DRAFTS-01-4: Given two chats with waiting drafts, Then `WaitingChats` returns exactly those two with their written times.
  - FR-DRAFTS-01-4: Given a draft made before `sessionStartedAt` (fake clock), Then `ListDrafts` shows `fromEarlierSession` true and `WaitingChats` shows `earlierSession` true; a draft made after shows false for both.
  - FR-DRAFTS-01-3: Given an order draft whose `OrderPreparer.revalidate` answers `catalogChanged` true, Then its view shows `catalogChanged` true; a reply view shows false.
- **Build:** `application/list-drafts.ts`, `application/waiting-chats.ts`.
- **Done when:** `bun test test/drafts/acceptance/list-and-waiting.test.ts` and `bun run typecheck` pass.

### Task 5: `ChangeDraft` and `RejectDraft`
- **Tests first:** `test/drafts/acceptance/change-and-reject.test.ts`, layer UC.
  - FR-DRAFTS-01-5: Given a held draft, When `ChangeDraft` runs with new text and the owner's words, Then the state is "waiting", `approvalVoided` is false (the held draft's approval was voided at the hold), and the log has a `text_changed` entry with the original proposed text, the new text and the owner's words.
  - FR-DRAFTS-01-5: Given a draft saved with a live approval (built through `Draft.rehydrate` and the in-memory repository), When `ChangeDraft` runs, Then `approvalVoided` is true and the log has an `approval_voided` entry.
  - FR-DRAFTS-01-5: Given an order draft, When `ChangeDraft` runs with a new `order`, Then `OrderPreparer.prepare` runs again and the stored text and payload are the new summary and payload. A `text` on an order draft is `wrong_kind`.
  - FR-DRAFTS-01-6: Given a waiting draft, When `RejectDraft` runs, Then the state is "rejected", the log has a `rejected` entry with the owner's words, and the draft is no longer listed. A rejected draft rejects every later `ChangeDraft` with `draft_closed`.
  - FR-DRAFTS-01-6: Given draft 4 does not exist, Then `RejectDraft` and `ChangeDraft` return `draft_not_found` and change nothing. Given a sent, rejected or replaced draft, Then both return `draft_closed` with the state.
  - FR-DRAFTS-01-6: Given a draft in "sending", Then `RejectDraft` and `ChangeDraft` return `send_in_progress`. Given "unknown", Then `ChangeDraft` returns `outcome_unknown_open` and `RejectDraft` succeeds.
  - FR-DRAFTS-01-5: Given the process does not own the lease, Then both return `not_owner`.
  - FR-DRAFTS-01-6: Given owner words that are empty, only spaces or 1,001 characters, Then both return `words_empty` and the draft is unchanged.
- **Build:** `application/change-draft.ts`, `application/reject-draft.ts`.
- **Done when:** `bun test test/drafts/acceptance/change-and-reject.test.ts` and `bun run typecheck` pass.

### Task 6: The Intake `ChatReader` adapter
- **Tests first:** `test/drafts/contract/intake-chat-reader.test.ts`, layer C against fake Intake ports (objects with `execute`), no Intake code.
  - FR-DRAFTS-01-1: Given `ChatExists` answers `exists: false`, Then `describe` returns null. Given a chat with messages, Then `describe` combines `ChatExists` and `ReadChat` into `hasCustomerMessage`, `latestCustomer` (the newest message with source `customer`) and `latest` (the newest message of the active world), with `Instant` times.
  - FR-DRAFTS-01-8: Given `activeWorldIsDev` true and false from `ChatExists`, Then `ChatInfo.activeWorldIsDev` equals it, and `hasNonDevMessage` is passed through.
  - FR-DRAFTS-01-3: Given `message(chat, id)` for an id Intake has, Then it returns the `ChatMessage` with `text` equal to Intake's `readerText`; for an id it lacks, null.
- **Build:** `adapters/intake/intake-chat-reader.ts`. It imports only Intake's `src/intake/index.ts` types (`ChatExists`, `ReadChat`). `src/main.ts` passes it the Intake use cases.
- **Done when:** `bun test test/drafts/contract/intake-chat-reader.test.ts` and `bun run typecheck` pass.

### Task 7: The published surface, the MCP tools, `main.ts` and the end-to-end flow
- **Tests first:** `test/drafts/acceptance/drafts-mcp.e2e.test.ts` (layer E, the server over stdio with the dev provider) and `test/architecture/drafts-rules.test.ts` (layer ARCH).
  - FR-DRAFTS-01-1: Given the dev provider and a delivered customer message, When the harness calls `create_draft`, `list_drafts`, `change_draft` and `reject_draft` in turn, Then each answers in plain text, the draft number is returned, the list shows the exact text and the answered message, the change returns state "waiting", and the reject returns "rejected".
  - FR-DRAFTS-01-3: Given a draft whose text and answered message contain `</customer_text>` and `&`, Then `list_drafts` returns them as `&lt;/customer_text&gt;` and `&amp;`, each inside its own `<customer_text>` label, through the shared helper. Given no drafts, Then the text says "no drafts waiting".
  - FR-KNOWLEDGE-01-14: Given a fake `catalogChangedSince`, When a reply draft was made at T and the fake says "changed", Then `list_drafts` shows the mark. Given "unchanged", no mark. Given "unknown", the code `catalog_check_unavailable` and no mark. Given an order draft whose `revalidate` says changed and the time check says unchanged, Then the mark shows.
  - FR-KNOWLEDGE-01-14: `drafts-rules.test.ts` parses imports and fails when any file under `src/drafts/application/` imports Knowledge or a Knowledge port (so `ListDrafts` calls nothing of Knowledge). The same test fails when any file other than `src/main.ts` imports `src/composition/mcp/`.
  - FR-DRAFTS-01-2: Given the e2e flow, Then `get_chat` shows no message with source "sent through Deputy" after `create_draft`.
  - FR-DRAFTS-01-8: Given the provider set to Kapso with a fake Kapso server and a chat that holds only dev messages, Then `create_draft` answers "that chat has only test messages".
  - FR-DRAFTS-01-5: Given the e2e flow, Then `change_draft` after `list_drafts` returns state "waiting".
- **Build:** `src/drafts/index.ts` (`createDrafts`), `src/drafts/adapters/mcp/drafts-tools.ts`, `src/composition/mcp/list-drafts-tool.ts`, the wiring in `src/main.ts`, `test/architecture/drafts-rules.test.ts`.
- **Done when:** `bun test test/drafts test/architecture` and `bun run typecheck` pass.

## Out of scope

- The real Orders adapter for `OrderPreparer`: Orders has no spec. The in-memory `FakeOrderPreparer` stands in.
- Approval, send, hold, retry, recovery and the log reads and checks: SPEC-02, SPEC-03 and SPEC-04. This spec only appends the log entries of its own events, through the log of SPEC-04 Tasks 1 and 2.
- Knowledge's `CatalogChangedSince` adapter: Knowledge's spec. `main.ts` passes a stub that answers "unknown" until then.
