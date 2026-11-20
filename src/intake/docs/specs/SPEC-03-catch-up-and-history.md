# Spec: Catch-up and history

Status: Approved (2026-11-19)

Rests on `../tp/TP-03-catch-up-and-history.md` (TP-03) and the cross-cutting `docs/tp/TP.md` (TD-5). FRD: `../frd/FRD-03-catch-up-and-history.md`. ADRs: Intake `ADR-007` (gap per scope), `ADR-008` (rate limit ends the run), `ADR-009` (history flag), `ADR-010` (`CatchUpChat`); cross-cutting `ADR-005` (catch-up loop).

## Context

SPEC-01 and SPEC-02 are done: `Provider` with the Kapso and dev adapters, `StoreMessages`, `IntakeUnitOfWork`, the repositories, `ReceiveLiveDelivery`, the reads, the listener, `catchup_status` (only `live_verified_at` used so far), `settings`, `isHistory`. This spec builds the catch-up loop on top: the single-flight `CatchUp` with its two sweeps, `SyncState` and its status, the gap probe, the scheduler, `CatchUpChat` (the pre-send read Drafts calls), the catch-up period setting and the Kapso pacing.

Decisions fixed by TP-03 and followed without a choice: two sweeps on the provider's clock; each pages its whole window and de-duplicates by `(provider, message id)`; the first connect imports everything as history; a `429` ends the run and the scheduler resumes at `retry_at`; a run has a 60-second budget; status is `complete` or `failed` with a reason from a fixed set; each page is committed in its own transaction; `CatchUpChat` waits, reads one conversation and one outbound page, and moves no mark.

Constants (domain, `src/intake/domain/constants.ts`). Each value has its reason from TP-03 "Settles without a choice":

| Constant | Value | Reason |
|---|---|---|
| `PAGE_SIZE` | 100 | the largest page Kapso accepts: fewest requests against 100 per minute |
| `OVERLAP_MS` | 600,000 (10 min) | five default periods; covers provider lag only; the launch live check records the real lag |
| `RUN_BUDGET_MS` | 60,000 | one rate-limit window |
| `CALLER_WAIT_MS` | 20,000 | the 15-second request timeout plus 5 seconds to store; below the 60-second tool timeout of the agents checked |
| `TELL_OWNER_AFTER_MS` | 600,000 (10 min) | five default periods of a refusal streak before an interruption is worth it |
| `MAX_PAGES` | 2,000 | 200,000 items per listing at 100 per page; 20 minutes of reading at 100 requests a minute |
| `DEFAULT_PERIOD_MINUTES` | 2 | FR-INTAKE-03-10 |
| `MIN_PERIOD_MINUTES` | 1 | one listing, one message read and one outbound page is at least three requests per run (FR-INTAKE-03-21) |
| `READ_RESERVE` | 10 | 10 per cent of the limit, about three sends in the same minute |
| `RATE_LIMIT_DEFAULT_WAIT_MS` | 60,000 | a `429` with no `Retry-After`: the plan limit is counted per minute (TP-04) |
| `CHAT_LOOKUP_WINDOW_MS` | 86,400,000 (24 h) | `CatchUpChat` with no stored conversation looks at conversations active in the last day (TP-03) |
| `PACE_MARGIN_MS` | 1,000 | the `Date` header has whole-second resolution |

Points the TPs left open, settled by the lead in L8 (`docs/DECISIONS.md`, 2026-11-18) and the choices this spec makes with them:

1. `newestStoredAt` and `oldestStoredAt` are computed over the messages stored under the provider (TP-03 says "non-dev, same provider"; under dev that would always be empty).
2. A `catchup_status` row whose `last_attempt_at` is null is "not yet run" (SPEC-02 point 4).
3. `tellOwner` is true for every failed reason except `usage_limit` shorter than 10 minutes, as TP-03 words it.
4. `CatchUpChat` publishes one `MessageStored` (origin `catch_up`) for the new non-history messages it stores, because the next catch-up would find them already stored and never signal them. TP-03 does not say.
5. `SetIntakeSettings` takes `ownerWords` as the shared `OwnerWords` and does not store it (Intake keeps no settings log).
6. `ApplyPendingChanges` needs a tick (SPEC-04, Task 6).
7. The combined tools `status`, `get_settings` and `set_setting` span slices, so this spec builds only `check_messages` and the pure use cases and formatters those tools call. They live in `src/composition/mcp/` (L8, SPEC-01 Task 13); this spec adds the sync-status section of `status` there, built in `main.ts` from `GetSyncStatus` and `formatSyncStatus`.

## Files

| Path | Change | Holds |
|---|---|---|
| `src/intake/domain/constants.ts` | create | the table above |
| `src/intake/domain/sync-state.ts` | create | `SyncState`, `SyncReason`, `OutboundResume` |
| `src/intake/domain/status-text.ts` | create | `reasonText`, `formatInstant` |
| `src/intake/domain/events.ts` | change | adds `CatchUpFinished` to `IntakeEvent` |
| `src/intake/ports/sync-state-repository.ts` | change | adds `load`, `save` |
| `src/intake/ports/message-repository.ts` | change | adds `newestStoredBefore`, `newestStoredAt`, `oldestStoredAt` |
| `src/intake/ports/intake-settings-repository.ts` | create | `IntakeSettingsRepository` |
| `src/intake/ports/catch-up.ts`, `catch-up-chat.ts`, `get-sync-status.ts`, `get-intake-settings.ts`, `set-intake-settings.ts` | create | inbound ports |
| `src/intake/application/run-coordinator.ts` | create | single-flight |
| `src/intake/application/sweeps.ts` | create | the two sweeps |
| `src/intake/application/gap-probe.ts` | create | `probeGap` |
| `src/intake/application/status-view.ts` | create | builds `SyncStatusView` |
| `src/intake/application/catch-up.ts`, `catch-up-chat.ts`, `get-sync-status.ts`, `get-intake-settings.ts`, `set-intake-settings.ts` | create | use cases |
| `src/intake/application/store-messages.ts` | change | none in behavior; catch-up passes pages through it |
| `src/intake/adapters/sqlite/sqlite-sync-state-repository.ts`, `sqlite-message-repository.ts` | change | `load`, `save`, the three queries |
| `src/intake/adapters/sqlite/sqlite-intake-settings-repository.ts` | create | reads and writes `settings` keys |
| `src/intake/adapters/memory/in-memory-intake-store.ts` | change | the same additions |
| `src/intake/adapters/memory/in-memory-intake-settings-repository.ts` | create | test adapter |
| `src/intake/adapters/scheduler/catch-up-scheduler.ts` | create | the timer loop |
| `src/intake/adapters/kapso/pacer.ts` | create | read pacing; `kapso-provider.ts` uses it (change) |
| `src/intake/adapters/mcp/intake-tools.ts` | change | adds `check_messages`; exports `formatSyncStatus` |
| `src/intake/index.ts`, `src/main.ts` | change | publishes and wires the new use cases and the scheduler |
| `test/support/fake-clock.ts` | change | adds `autoAdvance` |
| `test/support/fake-kapso-server.ts` | change | takes an injected `now`; counts requests per fixed minute; records a request log; a gate on the send answer (`holdSendAnswer()` and `releaseSendAnswer()`) so a test can end the process while a send is in flight |
| `test/support/harness.ts` | change | adds `kill()`: ends the server process without a clean stop, so a test can restart it on the same data directory |
| `test/support/fake-provider.ts` | change | scripted listings with delays and errors |
| `test/intake/unit/sync-state.test.ts`, `status-text.test.ts` | create | domain unit |
| `test/intake/contract/sync-state-repository.contract.test.ts`, `intake-settings-repository.contract.test.ts` | create | adapter contract |
| `test/intake/acceptance/catch-up.test.ts`, `catch-up-failures.test.ts`, `gap-probe.test.ts`, `catch-up-chat.test.ts`, `sync-status-and-settings.test.ts`, `catch-up-scheduler.test.ts` | create | use case acceptance |
| `test/intake/contract/kapso-pacing.contract.test.ts` | create | adapter contract against the fake Kapso server |
| `test/e2e/check-messages.test.ts` | create | end to end |

## Interfaces

### Domain

```ts
// domain/sync-state.ts
export type SyncReason =
  | "not_yet_run" | "unreachable" | "credentials" | "quota" | "usage_limit" | "timeout"
  | "bad_response" | "possible_gap" | "catching_up" | "storage";
export type StoredReason = Exclude<SyncReason, "not_yet_run">;

export interface OutboundResume { readonly cursor: string; readonly from: Instant | null; readonly runStart: Instant }

export interface SyncStateProps {
  provider: ProviderName;
  status: "complete" | "failed";
  reason: StoredReason | null;
  lastAttemptAt: Instant | null;      // local clock
  lastSuccessAt: Instant | null;      // local clock
  runStartedAt: Instant | null;       // local clock
  connectedAt: Instant | null;        // provider clock, set once
  markConversations: Instant | null;  // provider clock
  markOutbound: Instant | null;       // provider clock
  outboundResume: OutboundResume | null;
  failedSince: Instant | null;
  rateLimitedSince: Instant | null;
  retryAt: Instant | null;
  gap: { storedAt: Instant; returnedAt: Instant } | null;
  firstImportCount: number;
  liveVerifiedAt: Instant | null;
}

export class SyncState {
  static initial(provider: ProviderName): SyncState;          // lastAttemptAt null: "not yet run"
  static rehydrate(p: SyncStateProps): SyncState;
  readonly props: SyncStateProps;
  isNotYetRun(): boolean;                                       // lastAttemptAt === null
  begin(i: { providerTime: Instant; now: Instant }): void;      // lastAttemptAt = runStartedAt = now; connectedAt ??= providerTime
  advanceConversations(to: Instant): void;                      // never moves back
  completeConversations(runStart: Instant): void;               // markConversations = max(mark, runStart)
  saveOutboundResume(r: OutboundResume): void;
  completeOutbound(runStart: Instant): void;                    // markOutbound = max(mark, runStart); resume = null
  countStored(n: number): void;                                 // adds to firstImportCount while lastSuccessAt is null
  complete(now: Instant): void;                                 // status complete, reason null, lastSuccessAt = now; clears failedSince, rateLimitedSince, retryAt, gap
  fail(reason: StoredReason, now: Instant, retryAfterMs?: number | null): void;
  // failed; failedSince set when it was null; usage_limit sets rateLimitedSince when null and retryAt = now + (retryAfterMs ?? RATE_LIMIT_DEFAULT_WAIT_MS);
  // any other reason clears retryAt; possible_gap is set through setGap first.
  setGap(g: { storedAt: Instant; returnedAt: Instant }): void;
  tellOwner(now: Instant): boolean;                             // false when complete; false for usage_limit while now - rateLimitedSince < TELL_OWNER_AFTER_MS; else true
}

// domain/status-text.ts
export function formatInstant(t: Instant): string;              // new Date(t).toISOString()
export function reasonText(r: SyncReason, i: { newestStoredAt: Instant | null; gap: { storedAt: Instant; returnedAt: Instant } | null }): string;
```

`reasonText` wording is fixed (TP-03 "Status wording"), English only (D20), and ends with the newest stored time:

| Reason | Sentence |
|---|---|
| `not_yet_run` | `Deputy has not checked Kapso yet.` |
| `unreachable` | `Could not reach Kapso.` |
| `credentials` | `Kapso did not accept the key. Check it where Setup put it.` |
| `quota` | `The Kapso message quota is used up.` |
| `usage_limit` | `Kapso asked me to slow down.` |
| `timeout` | `Kapso did not answer in time.` |
| `bad_response` | `Kapso sent an answer I could not read.` |
| `possible_gap` | `Some messages between <storedAt> and <returnedAt> may be missing. Check the WhatsApp Business app for that period.` |
| `catching_up` | `Still catching up. Messages stored so far are kept.` |
| `storage` | `Deputy could not write to its storage.` |

After the sentence: ` The newest message I have is from <time>.` or ` I have no messages yet.` The text never holds provider text.

`CatchUpFinished` (added to `domain/events.ts` and to `IntakeEvent`):

```ts
export interface CatchUpFinished {
  readonly name: "CatchUpFinished";
  readonly provider: ProviderName;
  readonly status: "complete" | "failed";
  readonly reason: SyncReason | null;
  readonly storedCount: number;     // all stored, history included
  readonly finishedAt: Instant;
}
```

### Outbound ports

```ts
// ports/sync-state-repository.ts  (adds to the SPEC-02 methods)
export interface SyncStateRepository {
  markLiveVerified(provider: ProviderName, at: Instant): Promise<void>;
  liveVerifiedAt(provider: ProviderName): Promise<Instant | null>;
  connectedAt(provider: ProviderName): Promise<Instant | null>;
  load(provider: ProviderName): Promise<SyncState | null>;
  /** Upsert. mark_conversations, mark_outbound and connected_at are written as MAX(old, new) (connected_at keeps the first value), so a stale in-memory state never moves a mark back. live_verified_at is never overwritten by save. */
  save(s: SyncState): Promise<void>;
}

// ports/message-repository.ts  (adds)
export interface MessageRepositoryGap {
  /** Newest sent_at stored under `provider` in `scope` that is older than `before`, or null. */
  newestStoredBefore(provider: ProviderName,
    scope: { conversationRef: string } | { ownerOrDeputy: true }, before: Instant): Promise<Instant | null>;
  newestStoredAt(provider: ProviderName): Promise<Instant | null>;   // MAX(sent_at)
  oldestStoredAt(provider: ProviderName): Promise<Instant | null>;   // MIN(sent_at)
}
// MessageRepository extends MessageRepositoryGap. The scope { ownerOrDeputy: true } is source in ('owner_app','sent_through_deputy').

// ports/intake-settings-repository.ts
export interface IntakeSettingsRepository {
  getCatchUpMinutes(): Promise<number>;                       // DEFAULT_PERIOD_MINUTES when absent
  setCatchUpMinutes(n: number, at: Instant): Promise<void>;
  getCountry(): Promise<string | null>;
  setCountry(code: string, at: Instant): Promise<void>;
}
// keys in the shared settings table: 'catch_up_minutes' (integer 1 or more), 'country' (ISO 3166-1 alpha-2)
```

### Inbound ports (published in `index.ts`)

```ts
export interface SyncStatusView {
  provider: ProviderName;
  status: "complete" | "failed";
  reason: SyncReason | null;
  reasonText: string;
  running: boolean;
  lastAttemptAt: Instant | null;
  lastSuccessAt: Instant | null;
  newestStoredAt: Instant | null;
  oldestStoredAt: Instant | null;
  failedSince: Instant | null;
  retryAt: Instant | null;
  tellOwner: boolean;
  gap: { storedAt: Instant; returnedAt: Instant } | null;
  historyMaybeSyncing: boolean;       // first success happened, firstImportCount is 0 and newestStoredAt is null
  catchUpMinutes: number;
  storageFailureAt: Instant | null;   // StorageFailureLog
  lastLiveDeliveryVerifiedAt: Instant | null;
}

export interface CatchUp {
  execute(q: { trigger: "start" | "timer" | "asked" | "retry"; waitMs?: number /* default CALLER_WAIT_MS */ }): Promise<
    | { kind: "finished"; status: SyncStatusView; stored: number }
    | { kind: "still_running"; status: SyncStatusView }
    | { kind: "refused"; reason: "not_owner" }
  >;
}

export interface CatchUpChat {
  execute(q: { chat: ChatId; waitMs?: number }): Promise<
    | { kind: "fresh"; state: ChatStateView; newMessages: number }
    | { kind: "failed"; reason: "unreachable" | "credentials" | "quota" | "usage_limit" | "timeout" | "storage" }
    | { kind: "refused"; reason: "not_owner" }
  >;
}

export interface GetSyncStatus { execute(): Promise<SyncStatusView> }          // pure read, no lease
export interface GetIntakeSettings { execute(): Promise<{ catchUpMinutes: number; country: string | null }> }
export interface SetIntakeSettings {
  execute(q:
    | { key: "catch_up_minutes"; value: number; ownerWords: OwnerWords }
    | { key: "country"; value: string; ownerWords: OwnerWords }
  ): Promise<
    | { ok: true; value: number | string }
    | { ok: false; reason: "not_owner" }
    | { ok: false; reason: "below_minimum" | "not_an_integer"; minimum: 1; kept: number }
    | { ok: false; reason: "unknown_country"; kept: string | null }
  >;
}
```

`GetIntakeSettings` adds `country` to TP-03's `{ catchUpMinutes }` because the `country` setting has to be readable (TP-03 `SetIntakeSettings`, FR-INTAKE-03-21 test: "`get_settings` shows it").

### Application

```ts
// application/run-coordinator.ts
export class RunCoordinator {
  constructor(clock: Clock);
  get running(): boolean;
  /** Starts `work` when none runs, otherwise awaits the running one. Gives up after waitMs. */
  run<T>(work: () => Promise<T>, waitMs: number): Promise<{ kind: "done"; value: T } | { kind: "timeout" }>;
  waitIdle(waitMs: number): Promise<"idle" | "timeout">;   // CatchUpChat: waits, never starts
}

// application/catch-up.ts
export interface CatchUpDeps {
  provider: Provider; clock: Clock; lease: OwnerLease; uow: IntakeUnitOfWork; reads: IntakeRepos;
  store: StoreMessages; publisher: EventPublisher; coordinator: RunCoordinator; status: GetSyncStatus;
}
```

`CatchUp` run, steps in order (TP-03 "Algorithm"):

1. `OwnerLease.isOwner()` false: `refused`. Join `RunCoordinator.run(work, waitMs)`; `timeout` gives `still_running`.
2. Load `SyncState` (or `initial`) and keep its two marks, `markConversations` and `markOutbound`, as the pre-run marks: the sweeps below advance the marks, so the gap probe reads these saved copies, not the saved state. Read the first conversation page (`activeAfter = markConversations - OVERLAP_MS`, or null on the first import); its `serverTime` is `T0`. `begin({ providerTime: T0, now })`, then save the state in its own transaction, before anything is stored (so `connectedAt` is saved first). `deadline = now + RUN_BUDGET_MS`.
3. Sweep 1: page the conversation listing to its end (the first page is already read); sort ascending by `lastActiveAt`; for each conversation list its messages newest first, store each page in its own transaction oldest item first (`store.store(tx, { provider, events })`), stop the conversation at a page that holds an item with `sentAt < from1` or when the listing is exhausted; after each conversation `advanceConversations(lastActiveAt)` and save; check the deadline between conversations and between pages; at the end `completeConversations(T0)`.
4. Sweep 2: `from2 = markOutbound - OVERLAP_MS` or null; list `{ outbound: true }` newest first until an item is older than `from2` or the listing is exhausted; store each page as above; after each page `saveOutboundResume({ cursor, from: from2, runStart: T0 })` and save; a saved resume with the same `from2` continues from its cursor; when the provider refuses that cursor (`ProviderError("bad_response")` on the first request) the window restarts without a cursor; at the end `completeOutbound(T0)`.
5. Gap probe (below) for every listing read to its end, with the pre-run marks from step 2.
6. Finish: no error and no gap: `complete(now)`. Else `fail(reason, now, retryAfterMs)`. Save. Resolve the open `no_identifier` notes older than this run's local start when the run is complete (`resolveRecoverableBefore`). Publish one `MessageStored` (origin `catch_up`, from the folded summaries) when any non-history message was stored, one `OwnerReplyUnlinked` when any was unlinked, then `CatchUpFinished`.

Failure mapping: `unreachable`, `credentials`, `quota`, `timeout` and `bad_response` map to the same reason; `rate_limited` maps to `usage_limit` with `retryAfterMs`; a thrown storage error maps to `storage`; `LeaseLostError` stops the run with no write and returns `refused`; a run over the budget with progress (a page stored or a mark moved in this run) is `catching_up`, without progress `timeout`. A listing that repeats a cursor or passes `MAX_PAGES` is `bad_response`. Messages stored before a failure stay.

```ts
// application/gap-probe.ts
export function probeGap(i: {
  listings: ReadonlyArray<{ scope: { conversationRef: string } | { ownerOrDeputy: true }; exhausted: boolean; oldestReturned: Instant | null }>;
  // the marks read in step 2, before any sweep: markConversations for a conversation, markOutbound for owner/Deputy
  marksBefore: { conversations: ReadonlyMap<string, Instant | null>; outbound: Instant | null };
  messages: MessageRepositoryGap; provider: ProviderName;
}): Promise<{ storedAt: Instant; returnedAt: Instant } | null>;
// For each exhausted listing with an oldest returned item O: when its pre-run mark is null or older than O (mark < O), and newestStoredBefore(scope, O) is not null, that is the gap (storedAt = that time, returnedAt = O). A mark at or after O means O was already read: no gap. The first gap found is kept.
```

`CatchUpChat` steps (TP-03): lease; `RunCoordinator.waitIdle(waitMs)`; read that chat's conversation newest first until an item older than the chat's newest stored time minus `OVERLAP_MS` (the chat's `ChatState`: the latest of `lastCustomerAt`, `lastAnswerAt`, `lastUnattributedAt`; null means read to the end); read one page of the outbound listing; store both through `StoreMessages` (one transaction each); return `ChatStateRepository.get` as `ChatStateView`. With no stored `conversationRef` it lists conversations active in the last `CHAT_LOOKUP_WINDOW_MS` and takes the one whose counterpart gives the chat (`lineChatId(PhoneNumber.fromInternational(counterpart))`). It moves no mark and writes no `SyncState`. A `ProviderError("rate_limited")` returns `failed`, reason `usage_limit`, with no wait; `bad_response` returns `unreachable`. The whole call is bounded by `waitMs` (default `CALLER_WAIT_MS`): on expiry it returns `failed`, reason `timeout`.

### Scheduler and pacing

```ts
// adapters/scheduler/catch-up-scheduler.ts
export class CatchUpScheduler {
  constructor(d: { catchUp: CatchUp; settings: GetIntakeSettings; status: GetSyncStatus; clock: Clock });
  start(): void;          // runs once with trigger "start", then loops
  stop(): void;           // sets the flag; returns at once; the loop ends at its next wake; a run in flight is guarded by the lease check at every page
}
// After a run: usage_limit waits until retryAt (trigger "retry"); catching_up runs again at once (trigger "retry"); any other result waits `catchUpMinutes` minutes read again before each wait (trigger "timer"). A throw from a run goes to console.error and the loop goes on.

// adapters/kapso/pacer.ts
export class Pacer {
  constructor(clock: Clock);
  observe(r: { remaining: number | null; serverTime: Instant }): void;   // after every response
  /** Reads call this first. When the last remaining was below READ_RESERVE, waits for the next whole minute of the provider clock plus PACE_MARGIN_MS, then forgets `remaining`. Sends never call it. */
  beforeRead(): Promise<void>;
}
```

Provider time between responses is `lastServerTime + (clock.now() - localTimeOfThatResponse)`; the wait is `60,000 - (providerNow mod 60,000) + PACE_MARGIN_MS`.

### MCP

`check_messages` has no input (`defineTool` with `{}`), calls `CatchUp` with `trigger = "asked"`, and answers with `formatSyncStatus(status)` plus the stored count; a `refused` result answers `isError: true` with the code `not_owner`. `formatSyncStatus(view: SyncStatusView): string` is a pure function exported for the combined `status` tool: it returns `reasonText`, "up to date as of <lastSuccessAt>" when there was a success, "history reaches back to <oldestStoredAt>", and the storage-failure and live-delivery lines when present. It never includes customer text.

## Data

None added. Files used: `catchup_status` (SPEC-02, `0005-catchup-status.sql`, exactly TP-03 "Information") and `settings` (SPEC-01). The table never holds provider error text.

## Tasks

### Task 1: `SyncState`, status wording and the repositories
- **Tests first:** Layers as named.
  - `test/intake/unit/sync-state.test.ts` (unit). FR-INTAKE-03-6: Given a new state, Then `isNotYetRun()` is true. Given `begin`, Then `connectedAt` is set once and a second `begin` with another time leaves it. Given `advanceConversations(100)` then `(50)`, Then the mark is 100. Given `complete(now)`, Then `reason` is null and `lastSuccessAt` is `now`. Given `fail("usage_limit", now, 30000)`, Then `retryAt` is `now + 30000`, `rateLimitedSince` is `now`, and `tellOwner(now + 9 min)` is false and `tellOwner(now + 10 min)` is true; `fail("usage_limit", now, null)` gives a `retryAt` of `now + 60000`. Given any complete run after a streak, Then `rateLimitedSince` and `failedSince` are null. Given `fail("unreachable", ...)`, Then `tellOwner` is true and `retryAt` is null. Given `countStored(3)` before the first success and after it, Then only the first adds to `firstImportCount`.
  - `test/intake/unit/status-text.test.ts` (unit). FR-INTAKE-03-7: Given every `SyncReason`, Then `reasonText` returns the sentence of the table plus the newest-time sentence, the `possible_gap` text names both times and the WhatsApp Business app, `unreachable` reads "Could not reach Kapso.", and no text contains `error`, `http` or a status code (no provider text).
  - `test/intake/contract/sync-state-repository.contract.test.ts` (adapter contract, in-memory and SQLite). FR-INTAKE-03-6: Given a saved state, When `load` runs, Then every field is equal; for an unknown provider, null. Given a stale state with `markConversations` 50 saved after one with 100, Then the stored mark is 100 (never moves back). Given `markLiveVerified` then `save` of a state with another `liveVerifiedAt`, Then `liveVerifiedAt` is unchanged. Given a row created by `markLiveVerified` alone, Then `load` returns a state with `isNotYetRun() === true`. Given the dev and Kapso providers, Then each has its own row (a switch starts a new first import with its own `connectedAt`).
  - `message-repository.contract.test.ts` (extended). FR-INTAKE-03-13: Given messages of sent time 10 days ago (owner reply) and 3 days ago (customer) stored under Kapso and one dev message, When `newestStoredBefore(kapso, { ownerOrDeputy: true }, 3 days ago)` runs, Then it returns 10 days ago; `newestStoredAt` and `oldestStoredAt` ignore the dev message under Kapso.
  - `intake-settings-repository.contract.test.ts` (adapter contract). FR-INTAKE-03-21: Given an empty `settings` table, Then `getCatchUpMinutes` is 2. Given `setCatchUpMinutes(5, at)`, Then 5, and the row's `changed_at` is `at`. `getCountry` is null until set.
- **Build:** `constants.ts`, `sync-state.ts`, `status-text.ts`, the port changes, the SQLite and in-memory changes, `intake-settings-repository` (both adapters).
- **Done when:** `bun test test/intake` and `bun run typecheck` pass.

### Task 2: `CatchUp`, sweep 1, first import, history and signals
- **Tests first:** `test/intake/acceptance/catch-up.test.ts`. Layer: use case with `FakeProvider` (scripted pages), the in-memory store, `FakeClock`, `InMemoryOwnerLease`, `RecordingEventPublisher`.
  - FR-INTAKE-03-1: Given nothing stored and the provider holds 3 customer messages and 1 owner reply, When `CatchUp` runs with trigger `start`, Then all four are stored. The first listing call has `activeAfter = null`.
  - FR-INTAKE-03-2: Given no listener ever ran, When the first session asks, Then the messages that arrived while Deputy was off are stored.
  - FR-INTAKE-03-4: Given the provider returns an unreadable message, an owner echo, a duplicate and an out-of-order pair, When stored, Then the SPEC-02 rules apply (readable mark, de-duplication, sent order) and the echo has source `owner_app`.
  - FR-INTAKE-03-5: Given a run finds three new messages, When it ends, Then exactly one `MessageStored` with the folded items is published; a run that stores nothing publishes none; a `CatchUpFinished` is published either way.
  - FR-INTAKE-03-9: Given a finished run, When the owner asks again and nothing is new, Then no row is added and no `MessageStored` is published. Given two concurrent `CatchUp` calls, Then one run happens (the provider was listed once) and both return the same `finished` status.
  - FR-INTAKE-03-11: Given a number connected with 90 days of history, When the first run ends, Then the messages are stored once each with the history flag, including ones whose origin is not `history_sync` but whose time is before `connectedAt`; a message sent after `connectedAt` is not history.
  - FR-INTAKE-03-12: Given the history above, When the first run ends, Then no `MessageStored` item counts a history message.
  - FR-INTAKE-03-17: Given a message was stored live, When the next run lists it, Then it is stored once and signalled once (the live signal only); a run that finds nothing emits no signal.
  - FR-INTAKE-01-6: Given a message held at the dev provider and not delivered, When `CatchUp` runs, Then it is stored once and found by catch-up (the dev adapter, `/dev/hold` path of SPEC-01 Task 12 repeated at use case level).
  - Marks (TP-03 step 2): Given the first run, When it starts, Then `connectedAt` is saved before the first message is stored (the fake store records the order).
  - Not owner: Given the lease is not ours, Then `refused` and the provider is never called.
- **Build:** `run-coordinator.ts`, `sweeps.ts` (sweep 1 only), `catch-up.ts`, `status-view.ts`, `get-sync-status.ts` (so `finished` carries a view), `index.ts` additions, `CatchUpFinished`; `fake-clock.ts` `autoAdvance`.
- **Done when:** `bun test test/intake/acceptance/catch-up.test.ts` and `bun run typecheck` pass.

### Task 3: Sweep 2, windows, overlap and a lost lease
- **Tests first:** `test/intake/acceptance/catch-up.test.ts` (extended). Layer: use case, `FakeProvider`.
  - FR-INTAKE-04-4 (cross-cutting TD-5 list): Given an owner echo that does not move the conversation's `lastActiveAt`, When a run happens, Then sweep 2 finds and stores it with source `owner_app`.
  - FR-INTAKE-03-4: Given a live-delivered message stored while two earlier ones are missing, When a run lists the conversation, Then both earlier ones are stored (a known message does not stop the paging).
  - FR-INTAKE-03-20 support: Given a run killed after half the conversations by a refusal, When the next run starts, Then it resumes from the saved mark; and given sweep 2 killed after page 1 of 3, Then the saved `outboundResume` makes the next run request page 2 first; given the provider refuses that cursor, Then the window restarts and nothing is lost or duplicated.
  - Provider clock: Given a provider clock one hour off (`serverTime` and `sentAt` both shifted), When runs happen, Then nothing is lost (marks use provider time) and message order uses `sentAt`.
  - FR-INTAKE-03-2 (long absence): Given Deputy was off 10 days, When the run starts, Then it reads from `markConversations - OVERLAP_MS`, not from 7 days; a message from day 9 is stored. Given the window setting of Inbox changes, Then no extra read happens (no use case of this slice reads it).
  - FR-INTAKE-03-16: Given live delivery is on, When a message arrives live and a run happens later, Then the run lists it again and it is stored once.
  - Lease: Given the lease is lost between two pages, Then the run stops at the next page with no more writes and a second owner's marks are unchanged.
- **Build:** sweep 2, resume, conditional save, the lease check inside the unit of work.
- **Done when:** `bun test test/intake/acceptance/catch-up.test.ts` and `bun run typecheck` pass.

### Task 4: Failures, the rate limit and the budget
- **Tests first:** `test/intake/acceptance/catch-up-failures.test.ts`. Layer: use case, `FakeProvider` with scripted `ProviderError`s and delays, `FakeClock`.
  - FR-INTAKE-03-7: Given the provider is unreachable, When catch-up runs, Then status is `failed`, reason `unreachable`, the text says "Could not reach Kapso." and `newestStoredAt` is present. The same for `credentials` and `quota`.
  - FR-INTAKE-03-8: Given a run stored 2 of 5 messages and then failed, When the status is read, Then it is `failed`, the 2 messages remain, and no reader gets `complete`.
  - FR-INTAKE-03-14: Given the provider does not answer within 15 seconds (the fake raises `ProviderError("timeout")` after 15,000 ms of fake time), When catch-up runs, Then status is `failed`, reason `timeout`, and the call returned by 20 seconds. Given a provider that answers after 25 seconds, Then `CatchUp.execute({ waitMs: 20000 })` returns `still_running` at 20 seconds and a later read shows the run's result.
  - FR-INTAKE-03-20: Given a `429` with `retryAfterMs` 30,000, When the run handles it, Then stored messages and marks are kept, status is `failed`, reason `usage_limit`, `retryAt` is 30 seconds ahead, `tellOwner` is false; after 10 minutes of the same streak `tellOwner` is true; a complete run clears it.
  - FR-INTAKE-03-6: Given a run that ends on the 60-second budget after storing a page, Then status is `failed`, reason `catching_up`; with no progress, `timeout`.
  - Limits: Given a listing that repeats a cursor, and one that passes 2,000 pages, Then status is `failed`, reason `bad_response`.
  - Storage: Given the unit of work throws a storage error, Then reason `storage`.
- **Build:** the failure mapping, the budget, `retryAfterMs` handling.
- **Done when:** `bun test test/intake/acceptance/catch-up-failures.test.ts` and `bun run typecheck` pass.

### Task 5: The gap probe
- **Tests first:** `test/intake/acceptance/gap-probe.test.ts`. Layer: use case with `FakeProvider` and the in-memory store.
  - FR-INTAKE-03-15: Given the newest stored message is 10 days old and the exhausted listing's oldest item is 3 days old, When the run ends, Then status is `failed`, reason `possible_gap`, and `gap` names both times. Given a quiet shop (nothing new), Then no gap. Given a new conversation whose listing is exhausted and nothing older is stored, Then no gap. Given the first reply the owner ever sends, Then no gap.
  - FR-INTAKE-03-15 (b), two runs: Given the first run reported `possible_gap` with the conversation's pre-run mark null, When a second run lists the same conversation with the same oldest item, Then status is `complete`: the mark read before the second run is at or after that oldest item.
  - FR-INTAKE-03-15 (c), boundary: Given the pre-run mark is exactly O, the oldest returned item of an exhausted listing, and a stored message older than O, When the run ends, Then no gap.
  - FR-INTAKE-03-15 (d), a new conversation: Given a conversation with no stored message older than its oldest returned item, When the run ends, Then no gap, on this run and on every later run.
  - FR-INTAKE-03-15 (e), per-scope marks: Given the conversation's mark is at or after its oldest returned item while the owner/Deputy outbound mark is null, each scope with an older stored message, Then the gap is reported for the outbound scope only, and each scope is read against its own mark (`markConversations` for a conversation, `markOutbound` for owner/Deputy).
  - FR-INTAKE-03-15 (f), null mark: Given a null pre-run mark (before the first catch-up) and a stored message older than O, Then the gap is reported. Accepted limit: rows delivered live and older than a short provider retention can raise one `possible_gap` here.
  - FR-INTAKE-03-13: Given the provider holds only 3 days while 10 days are stored, When the run ends, Then status is `possible_gap`, the text names the WhatsApp Business app, and `oldestStoredAt` is exposed in the view.
- **Build:** `gap-probe.ts` and its use in the run.
- **Done when:** `bun test test/intake/acceptance/gap-probe.test.ts` and `bun run typecheck` pass.

### Task 6: `GetSyncStatus` and the settings
- **Tests first:** `test/intake/acceptance/sync-status-and-settings.test.ts`. Layer: use case with in-memory adapters.
  - FR-INTAKE-03-6: Given the last success was 6 hours ago, When `GetSyncStatus` runs, Then `lastSuccessAt` is that time and `newestStoredAt` is set. Before any run, the view is `failed`, reason `not_yet_run`. Given a first import of zero messages and nothing stored, Then `historyMaybeSyncing` is true.
  - FR-INTAKE-02-1 (view of the live check): Given a signed delivery was stored at time T, Then `lastLiveDeliveryVerifiedAt` is T and a catch-up does not change it.
  - FR-INTAKE-03-21: Given the owner sets 30 seconds (0.5 minute), When `SetIntakeSettings` runs, Then it refuses, `kept` is the previous value and the period is unchanged; given 1, Then it is accepted; given 0 or -3, Then `below_minimum`; given the owner is not the lease holder, Then `not_owner`.
  - FR-INTAKE-03-21: Given `SetIntakeSettings` with `country` "NI", When it runs, Then the value is stored and `GetIntakeSettings` shows it; Given "XX", Then it refuses with `unknown_country` and keeps the old value (`PhoneNumberParser.isCountry`).
- **Build:** `get-sync-status.ts` (complete), `get-intake-settings.ts`, `set-intake-settings.ts`.
- **Done when:** `bun test test/intake/acceptance/sync-status-and-settings.test.ts` and `bun run typecheck` pass.

### Task 7: The scheduler, `check_messages` and the end-to-end run
- **Tests first:** `test/intake/acceptance/catch-up-scheduler.test.ts` (use case with fakes) and `test/e2e/check-messages.test.ts` (end to end).
  - FR-INTAKE-03-10: Given a fake clock and the default period, When 10 minutes pass with messages arriving at minute 3 and 7, Then runs happen at 0, 2, 4, 6, 8 and 10 and both messages are stored without being asked.
  - FR-INTAKE-03-10: Given the period changes to 5 between runs, Then the next wait is 5 minutes.
  - FR-INTAKE-03-20: Given a `429` with `Retry-After: 30`, Then the scheduler's next run starts at `retryAt`, not at the period; given `catching_up`, Then it runs again at once.
  - FR-INTAKE-03-16: Given live delivery is on, Then the scheduler still runs periodically.
  - FR-INTAKE-03-6: Given the server over stdio after a failed run with reason `credentials`, When `status` is called, Then its text holds the mode line and the `credentials` sentence from `reasonText`, and no provider text (E2E, `test/e2e/check-messages.test.ts`).
  - Resilience: Given a run that throws, Then the error goes to `console.error` and the loop continues.
  - FR-INTAKE-03-3: Given a delivery that claims to be a catch-up with no signature, When it is posted to `/webhook`, Then it is rejected with 401 and nothing is stored; given `check_messages` called with an argument `{ "messages": [...] }`, Then the argument is ignored and nothing is stored (end to end).
  - FR-INTAKE-03-9: Given the dev provider with a message held through `/dev/hold` (SPEC-01 Task 12), When the client calls `check_messages`, Then the answer says it is complete and `get_chat` shows the message; calling it again stores nothing new.
  - Not owner: Given a second server process on the same data folder, When the client calls `check_messages`, Then the answer is `isError: true` with the code `not_owner`.
- **Build:** `catch-up-scheduler.ts`, `check_messages` and `formatSyncStatus`, `main.ts` adds the sync-status section to `compositionTools` (`async () => formatSyncStatus(await getSyncStatus.execute())`; FR-INTAKE-03-6 is checked by the end-to-end test of this task through `status`), and wires the scheduler: it starts in the supervisor's `onAcquired` after recovery and stops in `onLost`.
- **Done when:** `bun test` and `bun run typecheck` pass.

### Task 8: `CatchUpChat`
- **Tests first:** `test/intake/acceptance/catch-up-chat.test.ts`. Layer: use case with `FakeProvider`, in-memory store, `FakeClock`.
  - FR-DRAFTS-03-1 (consumer rule): Given an owner reply made after a running catch-up began, When `CatchUpChat` runs for that chat, Then it waits for the run, reads the chat's conversation and one outbound page, stores the reply as `owner_app`, and the returned state has `lastAnswerAt` at the reply's time.
  - FR-INTAKE-03-9: Given `CatchUpChat` runs twice with nothing new, Then `newMessages` is 0 and no mark moved (`SyncState` unchanged).
  - FR-INTAKE-03-20: Given the provider answers `429`, Then `failed` with `usage_limit` at once, no wait and no mark moved.
  - FR-INTAKE-03-14: Given the provider is slow beyond `waitMs`, Then `failed` with `timeout` at `waitMs`.
  - Given a chat with no stored conversation, Then it lists conversations active in the last 24 hours and picks the one whose counterpart is the chat; given none, Then it reads only the outbound page.
  - Given new non-history messages are found, Then one `MessageStored` (origin `catch_up`) is published (Context point 4); given none, no event.
  - Not owner: Given the lease is not ours, Then `refused`.
- **Build:** `catch-up-chat.ts`, `index.ts` additions.
- **Done when:** `bun test test/intake/acceptance/catch-up-chat.test.ts` and `bun run typecheck` pass.

### Task 9: Kapso pacing and request counts
- **Tests first:** `test/intake/contract/kapso-pacing.contract.test.ts`. Layer: adapter contract against the fake Kapso server with an injected `FakeClock`, so its fixed one-minute windows are the clock's.
  - FR-INTAKE-03-18: Given an idle shop, When a periodic run finds nothing new, Then the fake server's log shows one conversation listing, one message read for each conversation active in the last 10 minutes, and one outbound page; with no recent activity that is two requests.
  - FR-INTAKE-03-19: Given a long absence (60 conversations, 250 requests needed) and `X-RateLimit-Remaining` falling toward 10, When the run goes on, Then the adapter waits for the next provider minute (fake time passes) and `remaining` never reaches 0 and no `429` is returned.
  - FR-INTAKE-03-19: Given sends, Then `sendText` skips the pacing (a send at `remaining` 5 is sent at once).
  - FR-INTAKE-03-20: Given the fake server returns `429` with `Retry-After: 30`, Then the adapter throws `rate_limited` with `retryAfterMs` 30,000 and does not sleep inside the call.
- **Build:** `pacer.ts` and its use in `kapso-provider.ts` (`KapsoProviderOptions` gains `pacer: Pacer`, built in `main.ts`: only `main.ts` instantiates an adapter); the fake server's injected clock and request log.
- **Done when:** `bun test test/intake/contract/kapso-pacing.contract.test.ts` and `bun run typecheck` pass.

## Out of scope

- `SendText`, `FindOutgoing`, `ApplyPendingChanges`: SPEC-04.
- The combined tools `status`, `get_settings`, `set_setting`: the composition outside any slice; this spec supplies `GetSyncStatus`, `GetIntakeSettings`, `SetIntakeSettings` and `formatSyncStatus`.
- Notice scheduling on `CatchUpFinished`: Notify. Resolving unknown sends on `CatchUpFinished`: Drafts.
- How long the provider retains messages and whether Kapso offers history as a bulk listing (TP-03 open questions 2 and 3).
- Recovering messages lost beyond the provider's retention: the status only tells the owner where to look (TP-03 open question 1).
