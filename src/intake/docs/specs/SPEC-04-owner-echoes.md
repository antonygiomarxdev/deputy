# Spec: Owner replies and source

Status: Draft

Rests on `../tp/TP-04-owner-echoes.md` (TP-04) and the cross-cutting `docs/tp/TP.md` (TD-4, TD-6, TD-8). FRD: `../frd/FRD-04-owner-echoes.md`. ADRs: Intake `ADR-011` (Deputy sends linked by provider message id), `ADR-012` (phone numbers), `ADR-013` (owner-number log); cross-cutting `ADR-004`, `ADR-008`. Decisions L2 and L4 apply.

## Context

SPEC-01 to SPEC-03 are done. Already built and used here: `OwnerNumbers`, its repository and the log table (SPEC-01 Task 7), `PhoneNumber` and `lineKey` (SPEC-01 Task 3), the `PhoneNumberParser` (SPEC-01 Task 7), `Message.receive` with `classifySource` (SPEC-02 Task 1), `StoreMessages` (SPEC-02), `outgoing`, `outgoing_parts`, `source_changes` and `pending_changes` (tables from SPEC-02 and SPEC-01), the catch-up loop that finds owner echoes (SPEC-03). This spec adds what is left of FRD-04: the use-case level source tests, the sending side (`SendText`, `splitText`, `FindOutgoing`, recovery of interrupted sends), the owner-number commands (`ApplyPendingChanges`, `DescribeNumber`, `GetOwnerNumbers`, the `list_owner_numbers` tool) and the last architecture rules.

Decisions fixed by TP-04 and followed without a choice: a message is `sent_through_deputy` only when a Deputy send's provider id matches it, `owner_app` when its sender is an owner number (by `sameLine`) or, under dev, the tester's owner mark, else `customer`; text, name and origin are never inputs; a stored source changes only from `owner_app` to `sent_through_deputy`, with a `source_changes` row; a missing link stays `owner_app` (L2: the safe direction, one extra hold); Intake writes no drafts log; owner numbers change only through a pending-change row from the owner's terminal, applied under the lease and logged with the typed command (L4).

Constants (domain, added to `src/intake/domain/constants.ts`):

| Constant | Value | Reason |
|---|---|---|
| `MAX_PART` | 4,000 UTF-16 code units | Meta limits a text body to 4096 characters and does not say how it counts; code units are never fewer than code points; 96 spare. A part rejected after earlier parts went out makes the send `unknown`, so staying clear of the limit matters more than a few more characters |
| `SPLIT_LOOKBACK_UNITS` | 500 | about the last line of a long paragraph; a part gains nothing by being shorter |
| `OUTGOING_SKEW_MS` | 120,000 | the provider stamps a message with its own clock and an owner's laptop clock may be off by seconds to a minute or more; 120 s covers that skew plus the 15-second request timeout; a wider window only adds candidates that the exactly-one-match rule refuses. One constant, the same in Drafts TP-03 |

`RATE_LIMIT_DEFAULT_WAIT_MS` (60,000) comes from SPEC-03. The request timeout is the adapter's (`requestTimeoutMs`, SPEC-01); the use case sets none.

Points the TPs left open, settled by the lead in L8 (`docs/DECISIONS.md`, 2026-11-18) and the choices this spec makes with them:

1. A message that matches a Deputy send never gets mark `not_attributable` for lack of a sender: a Deputy send has a known chat, and with no business number configured its `from` is null. Without this rule every Deputy send under dev would hold all later sends.
2. A repeated `sendId` whose first call ended `rate_limited` stored `failure_reason = 'rate_limited'`; the repeat answers `rate_limited` with `retryAt` equal to the time that first call finished (in the past, so the caller retries at once with a new send id, as Drafts does).
3. `FindOutgoing` links only a send in state `unknown`; a `failed` send answers `none` (the state machine has no way from `failed` to `sent`).
4. When more than one rule of `FindOutgoing` applies the order is `ambiguous`, then `partial`, then `none`.
5. A `business_number` pending row with an empty value changes nothing; with another number it replaces the business number (a `remove` log row, then an `add` log row).
6. `ApplyPendingChanges` runs on the supervisor's tick (every `LEASE_RENEW_MS`, 10 s, because the supervisor already wakes then) and once at start, after `lease.tryAcquire()` and before `ResolveProviderSettings` (the order is in SPEC-01 Interfaces).
7. TP-04 types `OutgoingRepository` without a method that saves the send's own state; this spec adds `saveSend`.
8. `IntakeRepos` gains `pending` (a `PendingChangesReader`) so `ApplyPendingChanges` can mark rows applied in the same transaction as the set and the log.

## Files

| Path | Change | Holds |
|---|---|---|
| `src/intake/domain/constants.ts` | change | `MAX_PART`, `SPLIT_LOOKBACK_UNITS`, `OUTGOING_SKEW_MS` |
| `src/intake/domain/split-text.ts` | create | `splitText` |
| `src/intake/domain/outgoing-send.ts` | create | `OutgoingSend`, `OutgoingPart`, `SendState` |
| `src/intake/domain/message.ts` | change | `reclassifyAsDeputySend` |
| `src/intake/ports/outgoing-repository.ts` | change | the full `OutgoingRepository` |
| `src/intake/ports/message-repository.ts` | change | adds `reclassify`, `countCustomerMessages` |
| `src/intake/ports/pending-changes-reader.ts` | create | `PendingChangesReader`, `PendingChange` |
| `src/intake/ports/intake-unit-of-work.ts` | change | `IntakeRepos.pending` |
| `src/intake/ports/send-text.ts`, `find-outgoing.ts`, `get-owner-numbers.ts`, `describe-number.ts`, `apply-pending-changes.ts`, `mark-interrupted-sends.ts` | create | inbound ports |
| `src/intake/application/send-text.ts`, `find-outgoing.ts`, `get-owner-numbers.ts`, `describe-number.ts`, `apply-pending-changes.ts`, `mark-interrupted-sends.ts` | create | use cases |
| `src/intake/application/store-messages.ts` | change | a duplicate that matches a send reclassifies an `owner_app` message |
| `src/intake/adapters/sqlite/sqlite-outgoing-repository.ts`, `sqlite-message-repository.ts`, `sqlite-pending-changes-reader.ts`, `sqlite-intake-repos.ts` | change or create | the added methods |
| `src/intake/adapters/memory/in-memory-intake-store.ts` | change | the same |
| `src/intake/adapters/mcp/intake-tools.ts` | change | adds `list_owner_numbers` |
| `src/adapters/supervisor/lease-supervisor.ts` | change | optional `onTick` |
| `src/intake/index.ts`, `src/main.ts` | change | publish and wire |
| `test/architecture/architecture.test.ts` | change | three more rules |
| `test/intake/unit/split-text.test.ts`, `outgoing-send.test.ts` | create | domain unit |
| `test/intake/contract/outgoing-repository.contract.test.ts`, `pending-changes-reader.contract.test.ts` | create | adapter contract |
| `test/intake/acceptance/source.test.ts`, `send-text.test.ts`, `find-outgoing.test.ts`, `interrupted-sends.test.ts`, `owner-number-commands.test.ts` | create | use case acceptance |
| `test/intake/slice/send-and-echo.test.ts` | create | slice test, SQLite and the dev provider in one process |
| `test/e2e/owner-echo.test.ts` | create | end to end |

## Interfaces

### Domain

```ts
// domain/split-text.ts
export function splitText(text: string): string[];
```

Algorithm. Walk the graphemes of `text` (`new Intl.Segmenter(undefined, { granularity: "grapheme" })`, built into Bun and V8, no dependency). Add each grapheme to the current part while the part stays within `MAX_PART` UTF-16 code units. At the limit, cut after the last whitespace grapheme that lies in the last `SPLIT_LOOKBACK_UNITS` code units of the part (so a word is not cut), else cut at the grapheme boundary. A single grapheme longer than `MAX_PART` (hostile combining marks) is cut at a code point boundary, never inside a surrogate pair. No part is trimmed: joining the parts gives the original text. `splitText("")` returns `[]`. `SendText` never sends an empty text (step 1 below).

```ts
// domain/outgoing-send.ts
export type SendState = "pending" | "sent" | "failed" | "unknown";
export type SendFailure = "credentials" | "unreachable" | "quota" | "rejected" | "rate_limited";
export interface OutgoingPart { readonly index: number; readonly text: string; readonly providerMessageId: string | null; readonly state: SendState }
export interface OutgoingSendProps {
  sendId: SendId; chat: ChatId; text: string; state: SendState; failureReason: SendFailure | null;
  createdAt: Instant; finishedAt: Instant | null; parts: readonly OutgoingPart[];
}
export class OutgoingSend {
  static create(i: { sendId: SendId; chat: ChatId; text: string; createdAt: Instant }): OutgoingSend; // parts = splitText(text), all pending
  static rehydrate(p: OutgoingSendProps): OutgoingSend;
  readonly props: OutgoingSendProps;
  partSent(index: number, providerMessageId: string): void;           // the part becomes sent and holds its id
  failNothingAccepted(reason: SendFailure, at: Instant): void;        // every part failed; send failed
  interrupt(i: { index: number; mayHaveBeenAccepted: boolean; at: Instant }): void; // send unknown; that part unknown when it may have been accepted, else failed; later parts failed
  linkPart(index: number, providerMessageId: string, at: Instant): void;  // unknown part becomes sent; when every part is sent the send becomes sent
  markAllSentIfComplete(at: Instant): void;                           // pending send with every part sent becomes sent
  markPendingUnknown(): void;                                         // send and parts left pending become unknown
}
```

Invariants: `sendId` is unique; a part marked `sent` has a provider id; a `sent` send has every part `sent`; a send never goes back from `sent`, `failed` or `unknown` to `pending`; `linkPart` works only on a send in state `unknown`.

```ts
// domain/message.ts  (added)
export interface SourceChange { readonly at: Instant; readonly id: MessageId; readonly from: "owner_app"; readonly to: "sent_through_deputy"; readonly sendId: SendId }
// Message.reclassifyAsDeputySend(sendId: SendId, at: Instant): { ok: true; change: SourceChange } | { ok: false; reason: "not_owner_app" }
// Allowed only from source owner_app. It changes nothing else, and no signal is emitted for it.
```

`Message.receive` mark rule (Context point 1; built and unit-tested in SPEC-02 Task 1, `markOf` already takes `matchesSend`): when `ctx.matchesSend` is true, a missing sender never gives `not_attributable`; the mark is `normal`, or `group_chat` for a group. `markOf` takes a fourth input `matchesSend: boolean`.

### Ports

```ts
// ports/outgoing-repository.ts
export interface OutgoingRepository {
  find(sendId: SendId): Promise<OutgoingSend | null>;
  insert(s: OutgoingSend): Promise<void>;                      // the send and its parts
  savePart(s: OutgoingSend, part: number): Promise<void>;      // one part row
  saveSend(s: OutgoingSend): Promise<void>;                    // state, failure_reason, finished_at
  findByProviderId(provider: ProviderName, providerMessageId: string): Promise<{ sendId: SendId; part: number } | null>;
  /** Every outgoing row and part left pending becomes unknown. Returns the number of sends changed. */
  markPendingAsUnknown(): Promise<number>;
  /** Messages of `chat` with source owner_app and exactly this text, sent at or after `since`, whose id is in no outgoing_parts row. */
  candidatesForPart(chat: ChatId, text: string, since: Instant): Promise<MessageId[]>;
}

// ports/message-repository.ts  (adds)
//   reclassify(id: MessageId, change: SourceChange): Promise<void>;   // sets source and inserts the source_changes row, both or neither
//   countCustomerMessages(chat: ChatId): Promise<number>;             // non-dev messages with source customer

// ports/pending-changes-reader.ts
export interface PendingChange { readonly id: number; readonly key: "owner_numbers" | "business_number" | "owner_number_remove"; readonly value: string; readonly command: string; readonly at: Instant }
export interface PendingChangesReader {
  takeOwnerNumberChanges(): Promise<PendingChange[]>;      // unapplied rows of those three keys, oldest first
  markApplied(id: number, at: Instant): Promise<void>;
}
// ports/intake-unit-of-work.ts: IntakeRepos gains `pending: PendingChangesReader`.
```

### Inbound ports (published in `index.ts`)

```ts
export type SendTextResult =
  | { kind: "sent"; providerMessageIds: string[] }
  | { kind: "failed"; reason: "credentials" | "unreachable" | "quota" | "rejected" | "unsupported_chat" }
  | { kind: "rate_limited"; retryAt: Instant }   // nothing delivered; owner decision D29
  | { kind: "unknown"; partsSent: number; partsTotal: number }
  | { kind: "refused"; reason: "not_owner" };
export interface SendText { execute(q: { sendId: SendId; chat: ChatId; text: string }): Promise<SendTextResult> }

export type FindOutgoingResult =
  | { kind: "found"; providerMessageIds: string[] }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: number }
  | { kind: "partial"; found: number; expected: number }
  | { kind: "refused"; reason: "not_owner" };
export interface FindOutgoing { execute(q: { sendId: SendId; chat: ChatId; since: Instant; text: string }): Promise<FindOutgoingResult> }

export interface OwnerNumbersView {
  numbers: ReadonlyArray<{ number: string; kind: "business" | "extra"; label: string; addedAt: Instant }>;
  log?: ReadonlyArray<{ at: Instant; action: "add" | "remove"; number: string; kind: string; command: string }>;
}
export interface GetOwnerNumbers { execute(q: { withLog?: boolean }): Promise<OwnerNumbersView> }   // pure read, no lease

export interface DescribeNumber {                          // pure read, no lease; Setup shows a typed number back with it
  execute(q: { raw: string; defaultCountry: string | null }): Promise<
    | { e164: string; isOwnerNumber: boolean; customerMessages: number }
    | { invalid: "unparseable" | "needs_country_code" }
  >;
}
export interface ApplyPendingChanges { execute(): Promise<{ applied: number } | { refused: "not_owner" }> }
export interface MarkInterruptedSends { execute(): Promise<{ marked: number }> }
```

`SendText` steps (TP-04):

1. Lease check: not owner gives `refused`. An empty text gives `{ kind: "failed", reason: "rejected" }`. `unsupported_chat` when the chat is a group chat or `unattributed`, when the provider is Kapso and the chat has no non-dev message, or when the chat has no `providerId` that parses as a number. The destination is that `providerId`, never a caller-supplied value.
2. Look up `sendId`. When it exists, return its recorded outcome and send nothing: `sent` gives the part ids; `failed` gives its reason (`rate_limited` per Context point 2); `unknown` or `pending` gives `unknown` with the counts.
3. In one transaction insert `outgoing` (`pending`) and its parts (`OutgoingSend.create`).
4. For each part in order call `Provider.sendText({ to, text }, new AbortController().signal)`. The signal never aborts: the adapter enforces its own `requestTimeoutMs` (SPEC-01), and `application/` starts no timer outside `Clock`. On success, in one transaction: `partSent`, save the part, store the message with `StoreMessages` as a provider message (`direction: "outbound"`, `type: "text"`, `text` the part, `from` the business number's digits or null, `counterpart` the chat's `providerId`, `sentAt` the response `serverTime`, `origin` null); because the part row now holds the id, `matchesSend` is true and the source is `sent_through_deputy`; when the echo came first, `StoreMessages` reclassifies it and `MessageStored` is not emitted. On a `ProviderError`:
   - `rate_limited` at part 1: the send is `failed` with `failure_reason = rate_limited` and the result is `rate_limited` with `retryAt = now + (retryAfterMs ?? RATE_LIMIT_DEFAULT_WAIT_MS)`.
   - `mayHaveBeenAccepted` false at part 1: the send is `failed` with the mapped reason (`credentials`, `unreachable`, `quota`; `bad_response` and any other refusal map to `rejected`).
   - Anything else (a timeout or dropped connection, or a failure after an earlier part went out, including a `429` at part 2): `interrupt`; the send is `unknown` and the result is `unknown` with `partsSent` the parts accepted (it can be 0). The remaining parts are not sent.
5. When every part is `sent`, set the send `sent` and return the ids. No signal is emitted for a Deputy send (FR-INTAKE-02-9).

`StoreMessages` change: when a message is a duplicate and `matchesSend` is true and the stored message has source `owner_app`, call `reclassifyAsDeputySend` and `MessageRepository.reclassify`, then recompute the chat; this is how a report that arrived before the send was recorded becomes `sent_through_deputy` and is never stored twice.

`FindOutgoing` steps: lease check; find the send (it must exist and belong to `chat`, else `none`); a `sent` send gives `found` with its ids; a send in any state but `unknown` gives `none`. Split `text` with `splitText`; for each part ask `candidatesForPart(chat, part, since - OUTGOING_SKEW_MS)`. More than one candidate for any part gives `ambiguous`; else some parts with none and some with one gives `partial`; else all parts with none gives `none`. Only when every part has exactly one candidate, in one transaction: `linkPart` for each, `reclassify` each message, save the parts, set the send `sent`, recompute the chat. It makes no provider call. Drafts calls it after a catch-up.

`ApplyPendingChanges` steps: lease check; read the unapplied rows; for each row (oldest first) compute the change on one `OwnerNumbers` loaded once; in one transaction save the set and the log and mark every row applied:

- `owner_numbers`: the value is the full list of extra numbers, comma separated; each is parsed with `PhoneNumberParser` and the `country` setting as default; numbers missing from the set are added (kind `extra`, label empty), extras absent from the list are removed, each with one log row holding the row's typed command.
- `business_number`: parsed with no default country; an empty value changes nothing; another number replaces the business number (Context point 5); the same line changes nothing.
- `owner_number_remove`: parsed with the `country` default; removes that extra (matched by `sameLine`) and writes one `remove` log row. A removal of the business number, or of a number not in the set, changes nothing: the row is marked applied and a line goes to stderr.
- A row whose number cannot be parsed is marked applied with no change and logged to stderr (the command line already refuses such a value).

Result `{ applied }` is the number of rows marked applied. `MarkInterruptedSends` runs `OutgoingRepository.markPendingAsUnknown` in one transaction and returns the count; a lost lease returns `{ marked: 0 }`.

`DescribeNumber` parses `raw` through `PhoneNumberParser` with `defaultCountry`, answers `unparseable` or `needs_country_code` when the parser does, else the E.164 form, whether `OwnerNumbers.has` the number, and `countCustomerMessages(lineChatId(number))`. It writes nothing.

`list_owner_numbers` (no input) calls `GetOwnerNumbers` with `withLog: true` and returns each number with its kind and label, and the log with the typed commands. It is read-only.

Supervisor change: `LeaseSupervisorDeps.onTick?: () => Promise<void>`, called after each renewal while this process is the owner; a throw goes to `console.error`.

Architecture rules added to `checkArchitecture` (SPEC-01 Task 5):

- `source-classifier-import`: only `src/intake/domain/message.ts` imports `source-classifier`.
- `secret-reveal`: a call to `.reveal(` appears only under `src/intake/adapters/` and in `src/intake/application/receive-live-delivery.ts`; and `IntakeConnectionConfig` types its key fields as `Secret | null` (TP-01 "Secret is the only type that holds a key").
- `drafts-internals`: no file under `src/intake/` imports `src/drafts/` (the general cross-slice rule already covers it; this fixture proves FR-INTAKE-04-8).

## Data

None added. Tables used: `owner_numbers`, `owner_number_log` (SPEC-01, `0001-owner-numbers.sql`), `outgoing`, `outgoing_parts`, `source_changes` (SPEC-02, `0004-outgoing.sql`), `pending_changes` (SPEC-01, `0001-shared.sql`), `messages`, `chats`. A Deputy send that fails leaves an `outgoing` row (state `failed`, a reason from the fixed set `credentials`, `unreachable`, `quota`, `rejected`, `rate_limited`) and no `messages` row. A message Deputy sent has `source = 'sent_through_deputy'`, `sender` the business number when configured, `sent_at` the `serverTime` of the send response and `origin = NULL`.

## Tasks

### Task 1: `splitText`, `OutgoingSend` and the repositories
- **Tests first:** Layers as named.
  - `test/intake/unit/split-text.test.ts` (unit, TP-04 `splitText` tests). FR-INTAKE-04-6: Given 4,000 `a`, Then one part; given 4,001, Then two. Given a family emoji (8 code units, one grapheme) at the boundary, a flag emoji and an `e` plus a combining accent at the boundary, Then each stays whole. Given any input, Then no part contains a lone surrogate and joining the parts gives the original text. Given ten emoji that exceed the limit by code units but not by code points, Then the split is by code units. Given a text with a space inside the last 500 units of the first part, Then the cut is after that space. Given one grapheme made of 5,000 combining marks, Then it is cut at a code point boundary.
  - `test/intake/unit/outgoing-send.test.ts` (unit, TP-04 state machine). Given a new send, Then every part is `pending`. Given `partSent` for every part and `markAllSentIfComplete`, Then the send is `sent`. Given `interrupt` on part 2 of 3 with `mayHaveBeenAccepted`, Then the send is `unknown`, part 1 `sent`, part 2 `unknown`, part 3 `failed`. Given `failNothingAccepted`, Then `failed`. Given `linkPart` on a `sent` or `failed` send, Then it is refused (nothing changes). Given `markPendingUnknown`, Then pending parts are `unknown`. A `sent` part without an id cannot exist.
  - `test/intake/contract/outgoing-repository.contract.test.ts` (adapter contract, in-memory and SQLite). FR-INTAKE-04-13: Given an inserted send with two parts and `savePart`, When `find` and `findByProviderId` run, Then they return the send and `{ sendId, part }`; the same provider id in two parts is refused by the unique key. Given a send left `pending` with a `pending` part, When `markPendingAsUnknown` runs, Then both are `unknown` and the count is 1. Given owner messages of a chat with text "Hello" at times 100 and 5,000, one with source `customer`, and one already linked to a part, When `candidatesForPart(chat, "Hello", 1_000)` runs, Then only the unlinked `owner_app` message at 5,000 is returned.
  - `test/intake/contract/pending-changes-reader.contract.test.ts` (SQLite). FR-INTAKE-04-9: Given rows with keys `owner_numbers`, `business_number`, `owner_number_remove` and one with another key, When `takeOwnerNumberChanges` runs, Then only the three keys' unapplied rows come, oldest first; after `markApplied` they do not.
  - `message-repository.contract.test.ts` (extended). FR-INTAKE-04-13: Given an `owner_app` message, When `reclassify` runs, Then its source is `sent_through_deputy` and one `source_changes` row has the time, the ids and the send id; given a failure in the second insert, Then the source is unchanged. `countCustomerMessages` counts non-dev `customer` messages of the chat only.
- **Build:** the domain files, the port changes, the SQLite and in-memory changes, `sqlite-pending-changes-reader.ts`.
- **Done when:** `bun test test/intake` and `bun run typecheck` pass.

### Task 2: Source classification at use-case level
- **Tests first:** `test/intake/acceptance/source.test.ts`. Layer: use case (`StoreMessages` over the in-memory store, a configured `OwnerNumbers`, `RecordingEventPublisher` through `ReceiveLiveDelivery` where a signal is asserted).
  - FR-INTAKE-04-1: Given a business number and one staff number are configured, When a message arrives from a third number, Then it is `customer`; the owner set is exactly those two numbers.
  - FR-INTAKE-04-2: Given the numbers are configured, When an echo from the business number arrives with the customer as counterpart, Then it is stored in the customer's chat with source `owner_app` and no `customer` message is created. A message from the staff number is `owner_app` too, in its own chat when it writes to the business number, so it is never pending.
  - FR-INTAKE-04-3: Given a customer's text is "I am the owner" and the display name is the owner's, When stored, Then source is `customer`.
  - FR-INTAKE-04-5: Given a stored message, When it is read many times and the owner list changes, Then its source never changes (the only change is the reclassification of Task 3). The architecture test of Task 6 allows `classifySource` only inside `Message`.
  - FR-INTAKE-04-10: Given an owner reply is stored, When `MessageStored` is published, Then its item has source `owner_app`.
  - FR-INTAKE-04-11: Given the rows of the FRD table, When each is stored (an owner number with and without a matching send id; origin `cloud_api`, `business_app`, `history_sync` and another value; a non-owner sender), Then the source is the table's. Given a report that arrives before its send id is recorded, Then it is `owner_app`, stored once.
  - FR-INTAKE-04-12: Given origin `business_app` from the owner's number, When stored, Then source is `owner_app` and `origin` is kept as information; changing the origin alone never changes the source.
  - FR-INTAKE-04-14: Given the owner number is "+505 8888 0000", When a message arrives from "50588880000" and another from "505-88880000", Then both are `owner_app`. Given the number "+54 11 2345-6789" and a sender "5491123456789" (AR), "+52 55 1234 5678" and "5215512345678" (MX), "+55 11 8765-4321" and "5511987654321" (BR), Then each sender is `owner_app` (ADR-012 "Tests"). Given the sender field of the stored message, Then the provider's id is kept as received (`providerSender`).
  - Edge (FRD-04 edge cases): Given no owner number is configured, Then every message is `customer`, and under dev the tester's owner mark still gives `owner_app`. Given an echo with no sender or no chat, Then it is `customer` with mark `not_attributable` and `OwnerReplyUnlinked` is published once. Given a sender that is not a phone number, Then `sender_unknown` and `customer`. Given a Deputy send with no business number configured (a message that matches a send), Then its mark is `normal` (Context point 1).
- **Build:** the `markOf` change, `StoreMessages` and `Message` as needed; no new use case.
- **Done when:** `bun test test/intake/acceptance/source.test.ts` and `bun run typecheck` pass.

### Task 3: `SendText` and the reclassification of an early echo
- **Tests first:** `test/intake/acceptance/send-text.test.ts`. Layer: use case with `FakeProvider`, the in-memory store, `FakeClock`, `InMemoryOwnerLease`, `RecordingEventPublisher`.
  - FR-INTAKE-04-6: Given Drafts sent a reply with a send id, When `SendText` returns, Then exactly one message exists with source `sent_through_deputy` linked to the send id, with `sentAt` the response's `serverTime` and `origin` null, and an `outgoing` row is `sent`. The result lists the provider ids.
  - FR-INTAKE-04-7: Given that send, When the provider reports the same message back live (`ReceiveLiveDelivery`) and in catch-up (SPEC-03), Then still one message exists with source `sent_through_deputy`, and no `MessageStored` was published for it.
  - FR-INTAKE-04-13: Given a report was stored as `owner_app` first (a catch-up ran between the provider accepting the send and the response being stored), When `SendText` records the send id, Then exactly one message exists, its source is `sent_through_deputy`, `source_changes` has one row with the time, and no signal was emitted.
  - FR-INTAKE-04-8: Given a send, When it finishes, Then the only tables changed are `outgoing`, `outgoing_parts`, `messages`, `chats` and `source_changes`; no table or column of Drafts exists (run on the SQLite adapters on a temporary file: the row counts of every table are read before and after, only those five change, and `sqlite_master` holds no table whose name starts with `draft`).
  - Failures (TP-04 "Extra tests"): Given a send where part 2 of 3 fails, Then the result is `unknown` with `partsSent` 1 and the third part was never sent. Given a repeated `sendId`, Then nothing is sent and the recorded outcome is returned (`sent`, `failed` or `unknown`). Given a `429` with `Retry-After: 40` on part 1, Then `rate_limited` with `retryAt` 40 seconds ahead and an `outgoing` row `failed`; with no `Retry-After`, 60 seconds; a `429` on part 2, Then `unknown`. Given `ProviderError("credentials", null, false)` on part 1, Then `failed` reason `credentials` and no message row; likewise `unreachable`, `quota`, and `bad_response` giving `rejected`. Given a timeout (`mayHaveBeenAccepted` true), Then `unknown` with `partsSent` 0. Given a group chat, `unattributed`, a Kapso chat with only dev messages and a chat with no known destination, Then `failed` reason `unsupported_chat`. Given an empty text, Then `failed` reason `rejected` and no row. Given the lease is not ours, Then `refused` and nothing is recorded.
  - FR-INTAKE-04-6 (split): Given a text of 9,000 characters, Then three parts are sent in order, three messages are stored, and the result has three ids.
- **Build:** `send-text.ts`, the `StoreMessages` change, `FakeProvider.sendText` scripting.
- **Done when:** `bun test test/intake/acceptance/send-text.test.ts` and `bun run typecheck` pass.

### Task 4: `FindOutgoing`
- **Tests first:** `test/intake/acceptance/find-outgoing.test.ts`. Layer: use case with in-memory adapters.
  - FR-INTAKE-04-13: Given a send left `unknown` and one `owner_app` message of the chat with the send's exact text, sent after `since`, When `FindOutgoing` runs, Then the result is `found`, the message's source is `sent_through_deputy`, one `source_changes` row exists and the send is `sent`.
  - FR-INTAKE-04-13: Given two messages with that text, Then `ambiguous` with `candidates` 2 and nothing changed. Given a 3-part send where only 2 parts have a candidate, Then `partial` with `found` 2 and `expected` 3 and nothing changed. Given no candidate, Then `none`. Given a staff message sent 100 seconds before `since`, Then it is a candidate (the 120-second skew); one sent 200 seconds before is not.
  - FR-INTAKE-04-13: Given an already `sent` send, Then `found` with its ids; given a `failed` send, Then `none`; given a send of another chat, Then `none`; given a message already linked to another send, Then it is not a candidate.
  - Given the lease is not ours, Then `refused`.
- **Build:** `find-outgoing.ts`.
- **Done when:** `bun test test/intake/acceptance/find-outgoing.test.ts` and `bun run typecheck` pass.

### Task 5: Interrupted sends
- **Tests first:** `test/intake/acceptance/interrupted-sends.test.ts`, TP-04 "Interrupted sends" and cross-cutting ADR-011 crash tests. Layer: use case, plus one slice test on SQLite in Task 7.
  - FR-INTAKE-04-6: Given a send left `pending` with its parts `pending` (a restart), When `MarkInterruptedSends` runs, Then the send and its parts are `unknown` and `marked` is 1; a repeated `SendText` with that id then returns `unknown`.
  - FR-INTAKE-04-7: Given a crash between the provider accepting a part and the transaction that stores its id, When the process restarts and `MarkInterruptedSends` runs, Then the part is `unknown`, never `pending`, and a later catch-up stores the echo as `owner_app` until `FindOutgoing` links it.
  - Given `unknown.partsSent` 0, Then the send is still `unknown`. Given the lease is lost, Then `marked` is 0.
- **Build:** `mark-interrupted-sends.ts`; wire it in `main.ts` as the first step of the supervisor's `onAcquired` (before the scheduler and the listener start; cross-cutting TD-2).
- **Done when:** `bun test test/intake/acceptance/interrupted-sends.test.ts` and `bun run typecheck` pass.

### Task 6: Owner-number commands and the last architecture rules
- **Tests first:** `test/intake/acceptance/owner-number-commands.test.ts` (use case with in-memory adapters, a table-driven `PhoneNumberParser`) and the extended `test/architecture/architecture.test.ts`.
  - FR-INTAKE-04-9: Given messages from a staff number were stored as `customer`, When the owner adds that number (a `pending_changes` row with the typed command) and `ApplyPendingChanges` runs, Then old messages keep `customer`, new ones are `owner_app`, the log has one `add` row with the typed command and the row is applied.
  - FR-INTAKE-04-9: Given extra number "+505 8888 2222" is set, When `deputy config remove owner-number "+505 8888 2222"` writes its row and `ApplyPendingChanges` runs, Then the number is gone, new messages from it are `customer`, old ones keep their source and the log has one `remove` row with the typed command. Given the same for the business number or an unknown number, Then nothing changes, the row is marked applied and a line goes to stderr.
  - FR-INTAKE-04-1: Given an `owner_numbers` row with "+505 8888 2222, +505 8888 3333" and one existing extra "+505 8888 4444", Then the two are added, the absent one is removed, and the business number is untouched. Given a `business_number` row with another number, Then the old one is removed and the new one added (two log rows); with an empty value, nothing changes.
  - FR-INTAKE-04-14: Given "8888 0000" with default country NI and a stored customer chat for "+50588880000", When `DescribeNumber` runs, Then `e164` is "+50588880000", `isOwnerNumber` is false and `customerMessages` is that chat's count. Given no default country and no `+`, Then `needs_country_code`. Given an already owner number, Then `isOwnerNumber` is true. Given "8888 0000" when entered as an owner number row with no default country, Then it is refused (marked applied, no change, stderr).
  - FR-INTAKE-04-1: Given `GetOwnerNumbers({ withLog: true })`, Then the numbers carry kind and label and the log carries the typed commands, oldest first; without `withLog` no log. It asks no lease.
  - Not owner: Given the lease is not ours, Then `ApplyPendingChanges` returns `refused`, rows stay unapplied.
  - Architecture: Given a fixture where `src/intake/application/foo.ts` imports `source-classifier`, Then `source-classifier-import` is reported; given `.reveal(` in `src/intake/domain/x.ts`, Then `secret-reveal`; given `src/intake/application/x.ts` importing `../../drafts/application/y`, Then `cross-slice-internal`. Given the real `src/`, Then no violation.
- **Build:** the four use cases, `list_owner_numbers` in `intake-tools.ts`, the supervisor `onTick`, `main.ts` start order (`await lease.tryAcquire()`; when owner, `await applyPendingChanges.execute()`; `ResolveProviderSettings`; build the adapters; `supervisor.start()`; the order of SPEC-01's Interfaces), the three architecture rules and their fixtures.
- **Done when:** `bun test test/intake test/architecture` and `bun run typecheck` pass.

### Task 7: Slice and end-to-end tests
- **Tests first:** `test/intake/slice/send-and-echo.test.ts` (SQLite file, `DevProvider`, real `createIntake` in one process, `FakeClock`) and `test/e2e/owner-echo.test.ts` (end to end over stdio with the dev provider).
  - FR-INTAKE-04-6 and FR-INTAKE-04-7 (slice): Given `SendText` through the dev provider, When catch-up runs, Then the dev provider's outbound holding is found by sweep 2 and the stored message stays one row with source `sent_through_deputy`.
  - FR-INTAKE-04-13 (slice): Given the dev provider holds an owner echo (`owner: true`) with the same text as an unknown send, When `FindOutgoing` runs after a catch-up, Then the echo is linked and its source is `sent_through_deputy`.
  - Crash (slice, cross-cutting ADR-011): Given a send inserted `pending` in a SQLite file, When a new process opens the same file, acquires the lease and runs `MarkInterruptedSends`, Then it is `unknown`.
  - FR-INTAKE-04-4 (end to end): Given the owner replied from the app while Deputy was off (an `owner: true` body posted to `/dev/hold`), When the client calls `check_messages` and then `get_chat`, Then the reply is in the customer's chat labeled "owner from the app". Given live delivery on (an `owner: true` body posted to `/dev/deliver`) and the event that carries echoes unknown, Then catch-up alone is enough: the same reply posted only to `/dev/hold` is stored by the next `check_messages`.
  - FR-INTAKE-04-1 and FR-INTAKE-04-9 (end to end): Given a row inserted in `pending_changes` before start, When the server starts, Then `list_owner_numbers` shows the number and the typed command; given a row inserted while it runs, Then it shows within one supervisor tick (the test advances the clock in the slice variant; the end-to-end variant waits at most 15 seconds).
- **Build:** test support only (`test/support/harness.ts` helpers `holdOwnerReply`, `insertPendingChange`); fix whatever the slice tests expose.
- **Done when:** `bun test` and `bun run typecheck` pass for the whole repo.

## Out of scope

- Who calls `SendText` and `FindOutgoing` and what a held, failed or unknown send means to the owner: Drafts.
- Notices for `OwnerReplyUnlinked` and for owner replies (D30, FR-INTAKE-04-10 consumers): Notify.
- The command line that writes `pending_changes` (`deputy config set owner-numbers`, `business-number`, `remove owner-number`) and the reading back of its result: Setup specs. This spec reads the rows.
- The live check of the echo sender format in AR, MX and BR (ADR-012 launch gate), the live check that Kapso reports API sends back, and which webhook event carries an echo (FRD-04 open question 1): release work.
- A client reference on echoes (FRD-04 open question 2) and telling the owner of a send whose report never links (FRD-04 open question 3): not needed; the design uses the provider id stored at send time.
- Sending media, templates or messages outside the 24-hour window: not in v1.
