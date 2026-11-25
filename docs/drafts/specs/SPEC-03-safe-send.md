# Spec: Safe send and outcome (Drafts FRD-03)

Status: Approved (2026-11-18)
Rests on: ../tp/TP-03-safe-send.md

One per FRD, resting on [TP-03](../tp/TP-03-safe-send.md). It decides nothing new. It builds on SPEC-01 and SPEC-02: it completes `ApproveDraft` (steps 3 to 5 of the send path) and adds the retry, recovery and resolve use cases.

## Context

- FRD: [FRD-03](../frd/FRD-03-safe-send.md). TP: [TP-03](../tp/TP-03-safe-send.md). ADRs: ADR-006 (new since the draft), ADR-007 (hold choice inferred), ADR-011 (rate-limited send queued per chat), ADR-012 (window known from the latest customer message), ADR-002 and ADR-004 of Drafts' own set for the numbers and the revision check, cross-slice ADR-006 and ADR-011 in `docs/adr/`.
- Build order: SPEC-01, SPEC-02, then this spec, then SPEC-04 Tasks 2 to 6.
- From the foundation, not redefined (file names in SPEC-01 of this slice, Context): `Clock` (`now()`, `sleep(ms)`), `OwnerLease` (`isOwner(within?)` returns a promise), `SqlDatabase`, `ChatId`, `Instant`, `SendId`, `FakeClock`, `InMemoryOwnerLease`, `test/support/harness.ts` (`startServer(env)`, `call`), `test/support/fake-kapso-server.ts`, `customerText`, `LeaseSupervisor` (`onAcquired`, `onLost`) in `src/adapters/supervisor/lease-supervisor.ts`, and Intake's published events (`MessageStored`, `OwnerReplyUnlinked`, and `CatchUpFinished` from Intake SPEC-03).
- Intake ports called (objects with `execute`): `CatchUpChat({chat, waitMs}) -> fresh | failed | refused`, `ReadChat({chat, limit, storedSince})`, `SendText`, `FindOutgoing({sendId, chat, since, text})`.
- Orders has no spec: `OrderRecorder` (SPEC-02) is used here through its in-memory fake.
- The shared signal `SendNeedsOwner` is in `src/shared/signals.ts`, created by Intake SPEC-01: `{ reason: "held_after_retry" | "window_closed" | "retry_failed"; at: Instant }` (three reasons, L7; this spec publishes all three; an unlinked owner reply is Intake's own `OwnerReplyUnlinked` signal).
- Times are `Instant`. A 429 gives `retryAt` as an `Instant`; `drafts.retry_at` stores ISO text (SPEC-01 migration).

Choices this spec makes where TP-03 is silent (L9): `quota` maps to `fail_rejected` with log reason `quota`; queueing is a `sending` entry with reason `send_queued`; `{time}` in texts is ISO UTC and the agent renders it locally (D20); `messagesSince` returns both worlds and the policy filters; the four codes without a TP text have the default texts given above; `RecoverInterrupted.redriven` only counts; `unknown_outcome` covers unknown results that are not split sends.

## Files

| Path | Change | Holds |
|---|---|---|
| `src/drafts/domain/constants.ts` | create | `CATCH_UP_LIMIT_MS`, `CUSTOMER_WINDOW_MS`, `sendIdFor` |
| `src/drafts/domain/reasons.ts` | create | reason codes and their English default texts |
| `src/drafts/domain/freshness-policy.ts` | create | `FreshnessPolicy` |
| `src/drafts/domain/draft.ts` | change | `hold`, `queueRetry`, `failWindowClosed`, `recover`, the owner-choice flag |
| `src/drafts/domain/events.ts` | change | add `DraftHeld`, `OwnerChose`, `SendQueued` |
| `src/drafts/domain/log-mapper.ts` | change | cases for the new events |
| `src/drafts/ports/outbound.ts` | change | `ChatReader.messagesSince`, `ChatFreshness`, `OutgoingFinder`, `RetryScheduler`, `SendSignals` |
| `src/drafts/ports/inbound.ts` | change | `ApproveResult` completed; `RetrySend`, `ResolveUnknownSends`, `RecoverInterrupted`, `RedriveRecording` |
| `src/drafts/application/approve-draft.ts` | change | steps 3 to 5 and the failure mapping inside `driveSend` |
| `src/drafts/application/change-draft.ts`, `reject-draft.ts` | change | log the owner's choice after a hold |
| `src/drafts/application/retry-send.ts` | create | `RetrySend` |
| `src/drafts/application/resolve-unknown-sends.ts` | create | `ResolveUnknownSends` |
| `src/drafts/application/recover-interrupted.ts` | create | `RecoverInterrupted` |
| `src/drafts/application/redrive-recording.ts` | create | `RedriveRecording` |
| `src/drafts/adapters/memory/fake-chat-reader.ts` | change | `messagesSince` |
| `src/drafts/adapters/memory/fake-sender.ts` | change | scripted `failed`, `rate_limited`, `unknown` results and a hook run when `send` is called |
| `src/drafts/adapters/memory/fake-chat-freshness.ts` | create | `FakeChatFreshness` |
| `src/drafts/adapters/memory/fake-outgoing-finder.ts` | create | `FakeOutgoingFinder` |
| `src/drafts/adapters/memory/fake-retry-scheduler.ts` | create | `FakeRetryScheduler` |
| `src/drafts/adapters/memory/fake-send-signals.ts` | create | `FakeSendSignals` |
| `src/drafts/adapters/intake/intake-chat-reader.ts` | change | `messagesSince` over `ReadChat` |
| `src/drafts/adapters/intake/intake-chat-freshness.ts` | create | `ChatFreshness` over `CatchUpChat`, with the 20-second race |
| `src/drafts/adapters/intake/intake-outgoing-finder.ts` | create | `OutgoingFinder` over `FindOutgoing` |
| `src/drafts/adapters/scheduler/clock-retry-scheduler.ts` | create | `RetryScheduler`: one timer per chat on `Clock.sleep` |
| `src/drafts/index.ts` | change | new dependencies and use cases |
| `src/drafts/adapters/mcp/drafts-tools.ts` | change | `approve_draft` renders `held`, `queued`, `failed`, `unknown` |
| `src/main.ts` | change | wire the adapters; put the recovery steps in `onAcquired` and subscribe to `CatchUpFinished` on the shared `InProcessEventBus<E>` (`src/adapters/events/`, Intake SPEC-01) |
| `test/support/harness.ts` | change | `startServer` result gains `kill()` (SIGKILL of the child) when it has none; `env` may name an existing `DEPUTY_DATA_DIR` |
| `test/support/fake-kapso-server.ts` | change | a gate on the answer to a send: `holdSendAnswer()` and `releaseSendAnswer()` |
| `test/drafts/unit/freshness-policy.test.ts`, `draft-send.test.ts`, `reasons.test.ts` | create | domain tests |
| `test/drafts/contract/intake-freshness.test.ts`, `intake-outgoing-finder.test.ts`, `clock-retry-scheduler.test.ts` | create | adapter tests |
| `test/drafts/acceptance/safe-send.test.ts` | create | the check and the hold |
| `test/drafts/acceptance/send-outcome.test.ts` | create | outcomes |
| `test/drafts/acceptance/retry-send.test.ts` | create | the 429 queue |
| `test/drafts/acceptance/recovery.test.ts` | create | recovery, resolve, redrive |
| `test/drafts/acceptance/safe-send.e2e.test.ts` | create | over stdio with the fake Kapso server |
| `test/drafts/acceptance/crash.test.ts` | create | crash tests with real processes |

## Interfaces

`src/drafts/domain/constants.ts`:

```ts
/** 15 s request timeout of Intake plus 5 s to store; far under the 60 s tool timeout of the agents checked (TP-03 step 3). */
export const CATCH_UP_LIMIT_MS = 20_000;
/** WhatsApp's customer service window, from the customer's latest message (ADR-012). */
export const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;
/** The send id of an attempt: the approval's id for the first, "<id>:<attempt>" after a 429 (TP-03 TD-3). */
export const sendIdFor = (approvalSendId: string, attempts: number): string =>
  attempts === 0 ? approvalSendId : `${approvalSendId}:${attempts}`;
```

`src/drafts/domain/reasons.ts` (codes with an English default text, never a provider body; D20):

```ts
export type HoldReason = "catch_up_failed" | "catch_up_timeout" | "owner_answered" | "customer_wrote" | "unattributed_echo" | "draft_changed";
export type FailReason = "fail_not_reachable" | "fail_credentials" | "fail_window_closed" | "fail_rejected";
export type UnknownReason = "unknown_outcome" | "unknown_partial" | "unknown_first_part" | "order_outcome_unknown" | "session_ended";
export type StatusReason = "send_queued";
export type Reason = HoldReason | FailReason | UnknownReason | StatusReason | "found_after_unknown" | "order_command_failed";
export const REASON_TEXT: Readonly<Record<Reason, string>>;
/** Fills numbers and times; never customer or provider text. */
export function reasonText(code: Reason, fill?: { time?: string; part?: number; total?: number; sent?: number }): string;
```

`REASON_TEXT` values, from the TP-03 table: `catch_up_failed` "I could not check the chat, so I held the send."; `catch_up_timeout` "Checking the chat took too long, so I held the send."; `owner_answered` "You already answered this chat from the app."; `customer_wrote` "The customer wrote again after this draft."; `fail_not_reachable` "The provider could not be reached. Nothing was delivered."; `fail_credentials` "The provider refused the key. Nothing was delivered."; `send_queued` "The provider asked to slow down. Nothing was delivered. I will retry at {time} and check the chat again first."; `fail_window_closed` "The provider asked to wait until {time}, which is after WhatsApp's 24-hour window for this customer closes. Nothing was delivered. The customer must write first, then draft again."; `draft_changed` "The draft changed after you approved it, so I held the send. Say go again if it is still right."; `fail_rejected` "The provider refused this message. Nothing was delivered."; `unattributed_echo` "I found a reply from your number that I cannot match to any chat, so I stopped every send to be safe. Open WhatsApp and see which customer you answered. If that customer is waiting here, drop or change the draft. Then say send as is."; `unknown_outcome` "I cannot tell if it was delivered. Check the chat before you decide."; `unknown_partial` "Part {part} of {total} failed after part {sent} was delivered. Check the chat."; `unknown_first_part` "The first part may not have been delivered. Check the chat before you decide.". Four codes that TP-03 and TP-02 name without a text get one here: `order_outcome_unknown` "I cannot tell if the order was recorded. Check the orders before you decide."; `session_ended` "The session ended during the send, so I cannot tell if it was delivered. Check the chat before you decide."; `found_after_unknown` "The message was found in the chat after an unknown outcome."; `order_command_failed` "The order change was refused by Orders.". `{time}` is filled with the ISO-8601 UTC time of `retryAt`.

`src/drafts/domain/freshness-policy.ts`:

```ts
import type { ChatMessage } from "../ports/outbound";
import type { Mark } from "./draft";

export type Freshness = {
  readonly ownerAnswered: readonly ChatMessage[];
  readonly customerWrote: readonly ChatMessage[];
  readonly newestSeen: Mark;
};
export const FreshnessPolicy = {
  /** TP-03 TD-1 option C. Messages of the other world (dev !== draftDev) and sent_through_deputy messages are ignored.
   *  A message is new when its sentAt is after marks.sentAt, or its storedAt is after marks.storedAt and it is not flagged history.
   *  The history flag never hides a message sent after the draft. Source "owner_app" is an owner answer; "customer" is a customer message.
   *  newestSeen is the maximum of the marks and of every message of the draft's world that was returned. */
  evaluate(input: { messages: readonly ChatMessage[]; marks: Mark; draftDev: boolean }): Freshness;
};
```

`Draft` additions:

```ts
hold(input: { reasons: readonly HoldReason[]; seen: Mark; approval: Approval; now: Instant }): DraftChange;
// sending or recording -> "held"; pendingChoice = true; shownVersion = null; holdReason = reasons joined by ",";
// checkedThrough = seen; events DraftHeld and ApprovalVoided (reason "held"; approval id and send id from `approval`).
queueRetry(input: { retryAt: Instant; now: Instant }): DraftChange; // sending only: retryAt set, attempts + 1, state stays "sending"; event SendQueued
failWindowClosed(now: Instant): DraftChange;                        // sending -> "failed" with "fail_window_closed"; clears retryAt; event SendFailed
recover(now: Instant): DraftChange;                                 // sending with retryAt null -> "unknown" with "session_ended"; event OutcomeUnknown
```

Owner choice (TP-03 TD-2): while `pendingChoice` is true, the next successful `approve`, `changeText` or `reject` adds the event `OwnerChose` first (`"send_as_is"`, `"edit"` or `"drop"`) and clears the flag. A call that is refused changes nothing, so it logs no choice.

New `DraftEvent` members:

```ts
  | (Base & { readonly type: "DraftHeld"; readonly reasons: readonly HoldReason[]; readonly sendId: string })
  | (Base & { readonly type: "OwnerChose"; readonly choice: "send_as_is" | "edit" | "drop"; readonly ownerWords: string })
  | (Base & { readonly type: "SendQueued"; readonly retryAt: Instant; readonly attempt: number; readonly sendId: string })
```

Outbound ports added (`src/drafts/ports/outbound.ts`):

```ts
export interface ChatReader {
  /** ...SPEC-01 methods... Messages of both worlds (each marked dev), ordered by sentAt then storedAt. */
  messagesSince(chat: ChatId, since: Mark): Promise<ChatMessage[]>;
}
export interface ChatFreshness { // calls Intake CatchUpChat({ chat, waitMs })
  catchUp(chat: ChatId, waitMs: number): Promise<
    | { kind: "fresh"; unattributedStoredAt: Instant | null }
    | { kind: "failed"; reason: "unreachable" | "credentials" | "quota" | "usage_limit" | "timeout" | "storage" }
    | { kind: "refused"; reason: "not_owner" }>;
}
export interface OutgoingFinder { // calls Intake FindOutgoing; Intake links a match to sendId
  find(input: { chat: ChatId; since: Instant; text: string; sendId: string }): Promise<
    | { kind: "found" } | { kind: "none" } | { kind: "ambiguous" }
    | { kind: "partial"; found: number; expected: number }
    | { kind: "refused"; reason: "not_owner" }>;
}
export interface RetryScheduler { // one timer per chat; the adapter uses Clock.sleep, never setTimeout in a use case
  schedule(chat: ChatId, draft: DraftNumber, at: Instant): void; // replaces the chat's timer
  cancel(chat: ChatId): void;
}
export interface SendSignals { sendNeedsOwner(signal: SendNeedsOwner): void; } // published after the commit
export interface DraftLogRepository { /* SPEC-04 */ approvalEntryIdFor(sendId: string): Promise<number | null>; }
```

Inbound ports (`src/drafts/ports/inbound.ts`), the complete `ApproveResult`:

```ts
export type HeldMessage = { id: string; sentAt: string; source: "customer" | "owner_app"; text: string };
export type ApproveResult =
  | { outcome: "sent"; number: number; sendId: string; logged: boolean }
  | { outcome: "recorded"; number: number; orderId: string }
  | { outcome: "queued"; number: number; retryAt: string; code: "send_queued"; detail: string }
  | { outcome: "held"; number: number; reasons: { code: HoldReason; detail: string }[];
      messages: HeldMessage[]; choices: ["send_as_is", "edit", "drop"] }
  | { outcome: "failed"; number: number; reason: FailReason; detail: string }
  | { outcome: "failed"; number: number; reason: "order_refused"; detail: string } // detail is Orders' own refusal text
  | { outcome: "unknown"; number: number; reason: UnknownReason; detail: string };

export interface RetrySend { run(input: { draft: number }): Promise<"sent" | "queued" | "held" | "failed" | "unknown" | "skipped">; }
export interface ResolveUnknownSends { run(): Promise<{ resolved: number; stillUnknown: number }>; }
export interface RecoverInterrupted { run(): Promise<{ toUnknown: number; redriven: number }>; }
export interface RedriveRecording { run(): Promise<{ recorded: number; failed: number; unknown: number }>; }
```

The `failed` member keeps `reason` as the code. For an order refused by Orders, `reason` is Orders' text as given (SPEC-02).

The send path of `ApproveDraft`, after transaction 1 of SPEC-02 (steps 3 to 5 of TP-03). Every transaction below uses `requireLease: true` except the reads.
3. `ChatFreshness.catchUp(chat, CATCH_UP_LIMIT_MS)`. `refused` returns the refusal `not_owner` and leaves the draft "sending" (the new owner recovers it as "unknown"). `failed` with reason `timeout` holds with `catch_up_timeout`; any other failed reason holds with `catch_up_failed`. A hold here does not move the marks.
4. `ChatReader.messagesSince(chat, draft.checkedThrough)`, then `FreshnessPolicy.evaluate` with the draft's `dev`. Reasons: a non-empty `ownerAnswered` is `owner_answered`; a non-empty `customerWrote` is `customer_wrote`; `fresh.unattributedStoredAt` later than `checkedThrough.storedAt` is `unattributed_echo`, in any chat. Any reason holds. The hold moves both marks to `newestSeen`; for `unattributed_echo` the stored mark moves to at least `unattributedStoredAt`.
   - Hold = transaction 2: reload the draft, `approvals.void(number, "held", now)`, `Draft.hold`, `drafts.save`, append `approval_voided` and `held` entries (pointer: `log.approvalEntryIdFor(approval.sendId)`, always the approval's own send id, never the `<sendId>:<attempt>` id of a retry, because only the `approved` entry holds it). The result is `held` with the reasons (code and default text), the new messages (`ownerAnswered` and `customerWrote`, each with id, time, source and `text`), and the choices `["send_as_is", "edit", "drop"]`.
   - An order draft runs the same steps 3 and 4 before `OrderRecorder.record`.
5. Transaction 3: reload the draft; it must still be "sending" or "recording" at the revision read right after transaction 1; otherwise hold with `draft_changed`. `LeaseLost` returns `not_owner` and sends nothing. Then `driveSend` and transaction 4.

Result mapping in `driveSend` (transaction 4):

| Sender result | Draft | Log entry | Result |
|---|---|---|---|
| `sent` | `finishSent` | `sent` | `sent` |
| `failed` `unreachable` | `finishFailed("fail_not_reachable")` | `failed` | `failed` |
| `failed` `credentials` | `finishFailed("fail_credentials")` | `failed` | `failed` |
| `failed` `rejected` or `unsupported_chat` | `finishFailed("fail_rejected")` | `failed` | `failed` |
| `failed` `quota` | `finishFailed("fail_rejected")` | `failed` (the log reason is `quota`) | `failed` |
| `rate_limited`, `retryAt` after the customer's latest message plus `CUSTOMER_WINDOW_MS` | `failWindowClosed` | `failed` | `failed` with `fail_window_closed` |
| `rate_limited`, inside the window | `queueRetry`, `RetryScheduler.schedule(chat, number, retryAt)` | `sending` with reason `send_queued` | `queued` |
| `unknown`, `partsSent` 0 | `finishUnknown("unknown_first_part")` | `unknown` | `unknown` |
| `unknown`, `partsSent` 1 or more | `finishUnknown("unknown_partial")` | `unknown` | `unknown` |
| `refused` | none | none | refusal `not_owner` |

The customer's latest message time is `ChatReader.describe(chat).latestCustomer.sentAt`. An `unknown` result for any other cause (a result that is neither sent nor failed) uses `unknown_outcome`. A failed or unknown draft keeps `shownVersion` null, so a new go needs `list_drafts` first (FR-DRAFTS-03-7). Nothing retries by itself except the queued 429 (D29).

`RetrySend.run({ draft })` (called by the scheduler adapter): lease check (not owner gives `skipped`); load the draft; it must be "sending" with `retryAt` set, else `skipped`. Load the latest approval; the draft's `currentText` and `textVersion` must equal the approval's, else hold with `draft_changed`. Window check with the current clock: `now` after `latestCustomer.sentAt + CUSTOMER_WINDOW_MS` gives `failWindowClosed`. Then steps 3 and 4 and `driveSend` with the send id `sendIdFor(approval.sendId, draft.attempts)`. A second 429 queues again under the same rules. A hold or a `fail_window_closed` at retry publishes `SendSignals.sendNeedsOwner({ reason, at })` after the commit: `held_after_retry` for a hold, `window_closed` for `fail_window_closed`, `retry_failed` for any other retry that ends unsent (failed or unknown). A retry that sends or queues again publishes nothing. The approval is void after a hold, so the owner needs a new go.

`RecoverInterrupted.run()`: lease check (not owner returns zeros). For every open draft: "sending" with `retryAt` null becomes "unknown" through `Draft.recover` (log entry `unknown`, reason `session_ended`, pointer to the approval entry); "sending" with `retryAt` set is re-scheduled with `RetryScheduler.schedule(chat, number, max(retryAt, now))`; a draft in "recording" is counted in `redriven` and left for `RedriveRecording`.

`RedriveRecording.run()`: lease check. For each draft in "recording": `OrderRecorder.record` with the draft number, payload and the owner's words of its latest approval. `ok: true` gives `finishRecorded` (log `recorded`); `kind: "outcome_unknown"` gives `finishUnknown("order_outcome_unknown")` (log `unknown`); `kind: "refused"` gives `finishFailed(reason)`. An "unknown" order draft is never redriven by this use case.

`ResolveUnknownSends.run()`: lease check (not owner: zeros). For each reply draft in "unknown": take its latest approval and call `OutgoingFinder.find({ chat, since: approval.approvedAt, text: approval.text, sendId: sendIdFor(approval.sendId, draft.attempts) })`. `found`: one transaction applies `finishSent({ reason: "found_after_unknown" })` and appends a `sent` entry pointing to the approval entry; counted in `resolved`. `none`, `ambiguous` and `partial` change nothing and count in `stillUnknown`; `refused` skips the run. Drafts passes the approval time as is (Intake widens it by `OUTGOING_SKEW`).

`src/main.ts` wiring: the `onAcquired` function given to `LeaseSupervisor` runs, in this order: Intake's recovery, `RecoverInterrupted`, the first catch-up, `ResolveUnknownSends`, `RedriveRecording`, then the rest (Orders' `RedriveOutbox`, Notify's `StartNoticeSession`), and only then the scheduler and the listener. The "first catch-up" is a call to Intake's `CatchUp` with trigger "start" made by `onAcquired` itself, so that `ResolveUnknownSends` sees fresh messages. `CatchUpScheduler.start()` at the end runs one more catch-up at once; the second run is harmless because Intake's catch-up skips messages it already stored. A subscription to Intake's `CatchUpFinished` event runs `ResolveUnknownSends` when the run stored messages. `sessionStartedAt` is read from `Clock` when the lease is taken.

MCP rendering of `approve_draft`: `held` lists the reason codes with their texts, then each new message wrapped by the shared helper (customer messages in `<customer_text>`, owner replies from the app in `<owner_app_reply>`), then the three choices with their tools: "say go again, naming the draft, to send as is; `change_draft` to edit; `reject_draft` to drop". `failed` and `unknown` carry the code and the default text; `unknown` adds that Deputy does not retry and the owner decides after checking the chat. `queued` carries `retryAt` and the `send_queued` text.

## Data

None. `drafts.retry_at`, `drafts.attempts`, `pending_choice`, `hold_reason`, `fail_reason`, `checked_sent_at` and `checked_stored_at` are columns of SPEC-01's `0001-drafts.sql`. `approvals.send_id` and `voided_at` are in SPEC-02's migration. The log kinds are in SPEC-04's migration.

## Tasks

### Task 1: Domain: freshness policy, reasons, the hold and the retry methods
- **Tests first:** `test/drafts/unit/freshness-policy.test.ts`, `draft-send.test.ts`, `reasons.test.ts`, layer D.
  - FR-DRAFTS-03-3: Given a customer message whose text sounds like the owner ("I already answered you"), Then it is `customerWrote` and never `ownerAnswered`: only `source` decides.
  - FR-DRAFTS-03-3: Given an `owner_app` message flagged history and sent after the draft's mark, Then `ownerAnswered` holds it. Given a history message sent before the mark and stored after it, Then it is not new.
  - FR-DRAFTS-03-3: Given an echo stored after `checkedThrough.storedAt` with a sent time before `checkedThrough.sentAt` (a late echo), Then it is new.
  - FR-DRAFTS-03-3: Given `sent_through_deputy` messages, Then they are ignored. Given messages of the other world, Then they are ignored: a dev owner reply is new for a dev draft and never for a real one.
  - FR-DRAFTS-03-4: Given new messages, Then `newestSeen` is the newest sent and stored time of the returned messages of the draft's world and never earlier than the marks.
  - FR-DRAFTS-03-4: Given `Draft.hold` on a "sending" draft, Then the state is "held", `pendingChoice` is true, `shownVersion` is null, the marks are moved, and the events are `DraftHeld` and `ApprovalVoided` with reason "held".
  - FR-DRAFTS-03-12: Given `pendingChoice` true, Then `approve`, `changeText` and `reject` each add `OwnerChose` with "send_as_is", "edit" and "drop" before their own event, and clear the flag.
  - FR-DRAFTS-03-7: Given `queueRetry`, Then `retryAt` is set, `attempts` is 1, the state is still "sending", and `changeText`, `reject` and `replaceBy` still return `in_flight`. Given `failWindowClosed`, Then the state is "failed" with `fail_window_closed`.
  - FR-DRAFTS-03-8: Given `recover` on "sending" with no `retryAt`, Then the state is "unknown" with `session_ended`; on "sending" with `retryAt`, `recover` returns no change.
  - FR-DRAFTS-03-6: Given `reasonText`, Then every `Reason` has an English default text, the texts contain no customer or provider text, `unknown_partial` with part 2, total 3, sent 1 reads "Part 2 of 3 failed after part 1 was delivered. Check the chat.", and a result carries the code next to the text (a translating agent keeps the code).
  - FR-DRAFTS-03-7: `sendIdFor("deputy:a", 0)` is "deputy:a" and `sendIdFor("deputy:a", 2)` is "deputy:a:2".
- **Build:** `domain/{constants,reasons,freshness-policy}.ts`, the `Draft` methods and events, the log-mapper cases.
- **Done when:** `bun test test/drafts/unit` and `bun run typecheck` pass.

### Task 2: Ports, fakes and the Intake and scheduler adapters
- **Tests first:** `test/drafts/contract/intake-freshness.test.ts`, `intake-outgoing-finder.test.ts`, `clock-retry-scheduler.test.ts` and an added case in `intake-chat-reader.test.ts`, layer C or UC with fake Intake ports and `FakeClock`.
  - FR-DRAFTS-03-1: Given `CatchUpChat` answers `fresh` with a state carrying `unattributedStoredAt`, Then `catchUp` returns `fresh` with that value, and `null` when it is absent.
  - FR-DRAFTS-03-2: Given a fake `CatchUpChat` that ignores `waitMs` and never answers, When the `FakeClock` advances 20 seconds, Then `catchUp(chat, 20000)` returns `failed` with `timeout`. Given `CatchUpChat` answers `failed` with `quota`, Then the result is `failed` with `quota`. Given `refused`, `refused`.
  - FR-DRAFTS-03-3: Given `ReadChat` returns a late echo (old sent time, new stored time) and newer messages, Then `messagesSince` calls `ReadChat` with `limit: 50` and `storedSince` equal to the mark's `storedAt`, returns both worlds' messages marked `dev`, ordered by sent time then stored time, with `source`, `sentAt`, `storedAt` and `history`.
  - FR-DRAFTS-03-13: Given `FindOutgoing` answers `found`, `none`, `ambiguous`, `partial` and `refused`, Then the adapter returns the same kinds (`ambiguous` without its count) and passes `sendId`, `chat`, `since` and `text` unchanged.
  - FR-DRAFTS-03-7: Given `schedule(chatA, 3, t+40s)` and `schedule(chatB, 5, t+10s)` on the `FakeClock`, Then draft 5's retry fires at +10 s and draft 3's at +40 s, each once; `schedule` for the same chat replaces its timer; `cancel` stops it; no call to `setTimeout` exists in `src/drafts/application` or `src/drafts/domain` (a grep test).
- **Build:** the new ports, the in-memory fakes (`FakeChatFreshness` scripted per call, `FakeOutgoingFinder` scripted and able to turn a message of the fake chat into `sent_through_deputy` when it answers `found`, `FakeRetryScheduler` recording calls with a `fire(chat)` method, `FakeSendSignals`), and the adapters. `ClockRetryScheduler` takes a function returning `RetrySend` so `main.ts` can build it after the use cases.
- **Done when:** `bun test test/drafts/contract` and `bun run typecheck` pass.

### Task 3: The check before the send, the hold and the owner's choice
- **Tests first:** `test/drafts/acceptance/safe-send.test.ts`, layer UC (all fakes, `FakeClock`). Each test lists the drafts first.
  - FR-DRAFTS-03-1: Given an approved draft, Then the fake records `catchUp` before `messagesSince` before `send`, in that order. Given an order draft, Then the same two checks run before `OrderRecorder.record`.
  - FR-DRAFTS-03-2: Given `catchUp` returns `failed` (not timeout), Then the result is `held` with `catch_up_failed`, the draft is "held", the approval is void, `FakeSender` has no call, and the marks did not move. Given `catchUp` takes longer than 20 seconds on the `FakeClock`, Then `held` with `catch_up_timeout` and no send.
  - FR-DRAFTS-03-3: Given an `owner_app` message flagged history, sent after the draft, Then `held` with `owner_answered` and the result's `messages` holds it. Given a customer message with owner-sounding text, Then `held` with `customer_wrote`.
  - FR-DRAFTS-03-3: Given the dev provider (`dev` true on the draft), Then a dev owner reply holds a dev draft; given a real draft, a dev message never holds it.
  - FR-DRAFTS-03-4: Given `unattributedStoredAt` later than the draft's stored mark, in a different chat, Then `held` with `unattributed_echo` for every send. Given an owner answer or a new customer message, Then the result lists the three choices `["send_as_is", "edit", "drop"]`.
  - FR-DRAFTS-03-5: Given a hold for an owner answer, Then nothing is sent, the owner sees the answer in `messages`, and the same words without a fresh `list_drafts` are refused with `not_shown`. Given a fresh list and a new go that names the draft, Then the draft is sent and the check sees only messages newer than the moved marks.
  - FR-DRAFTS-03-11: Given a draft held for `customer_wrote`, When the owner says "send as is" without the draft number, Then `words_missing_number` and nothing is sent. Given words naming the draft, Then it is sent and no second hold occurs for the same message.
  - FR-DRAFTS-03-12: Given a held send, Then the log has `approval_voided` and `held` entries with the reason codes. Given the owner then picks "edit" through `ChangeDraft`, "drop" through `RejectDraft`, or "send as is" through `ApproveDraft`, Then the log has one `owner_choice` entry each, with the choice and the owner's words, before the next entries, and a refused call logs no choice.
  - FR-DRAFTS-03-4: Given a draft changed between transaction 1 and transaction 3 (the fake changes the revision), Then `held` with `draft_changed`. Given the lease lost before transaction 3, Then `not_owner`, no send, and the draft stays "sending".
- **Build:** the steps 3 to 5 in `application/approve-draft.ts`, the owner-choice logging in `change-draft.ts` and `reject-draft.ts`.
- **Done when:** `bun test test/drafts/acceptance/safe-send.test.ts` and `bun run typecheck` pass.

### Task 4: Outcomes of the send
- **Tests first:** `test/drafts/acceptance/send-outcome.test.ts`, layer UC.
  - FR-DRAFTS-03-6: Given `FakeSender` accepts, Then the owner is told it was accepted (`sent`) and the log has `sent` pointing to the approval entry. Given `failed` with each of `unreachable`, `credentials`, `rejected`, `unsupported_chat` and `quota`, Then the result carries the code and default text of the table above, and the draft is "failed" with that reason.
  - FR-DRAFTS-03-7: Given a failed draft, Then it stays listed with its reason, `ApproveDraft` without a fresh list returns `not_shown`, and `FakeSender` is never called again by itself (the fake clock advances an hour with no call). Given a fresh list and a new go, Then it is sent.
  - FR-DRAFTS-03-8: Given `unknown` with `partsSent` 0, Then the draft is "unknown", the text is "The first part may not have been delivered. Check the chat before you decide.", and `FakeSender` has one call. Given `partsSent` 1 of 3, Then the text names the parts. Nothing retries by itself.
  - FR-DRAFTS-03-8: Given an "unknown" draft whose first message did arrive and was not linked (an `owner_app` message newer than the marks), When the owner approves again, Then the check holds with `owner_answered` and nothing is re-sent.
  - FR-DRAFTS-03-9: Given an accepted send, Then at the moment `FakeSender.send` is called the approval row exists with `usedAt` set, the draft is "sending", the `approved` and `sending` log entries exist, and the send id is `deputy:` plus the approval id; after the call the `sent` entry is written.
  - FR-DRAFTS-03-10: Given a `FakeSender` that stores the message as `sent_through_deputy` (Intake's behavior) and a second draft for the same chat, Then the second draft's check finds no new message and is not held by Deputy's own echo.
  - FR-DRAFTS-03-6: Given an order draft recorded, Then the result is `recorded` with the order id.
- **Build:** the result mapping in `driveSend`, `reasons`, the log entries.
- **Done when:** `bun test test/drafts/acceptance/send-outcome.test.ts` and `bun run typecheck` pass.

### Task 5: The queued 429 and `RetrySend`
- **Tests first:** `test/drafts/acceptance/retry-send.test.ts`, layer UC (`FakeRetryScheduler`, `FakeSendSignals`).
  - FR-DRAFTS-03-7: Given `rate_limited` with `retryAt` 40 seconds ahead, Then the result is `queued` with `send_queued`, the draft stays "sending" with `retryAt` and `attempts` 1, `FakeRetryScheduler` has `schedule(chat, number, retryAt)`, and `list_drafts` shows `retryAt`. When the `FakeClock` reaches that time and the scheduler fires, Then the checks run and the message is sent once with the send id `<approval id>:1`.
  - FR-DRAFTS-03-7: Given chat A queued for 40 seconds, Then a send in chat B goes out at once.
  - FR-DRAFTS-03-4: Given at the retry time the customer has written again, or an owner reply from the app exists, or an unlinked owner reply exists (`unattributed_echo`), Then the send is held, the approval is void, `sendNeedsOwner` is published with `held_after_retry` after the commit, and nothing is sent.
  - FR-DRAFTS-03-7: Given a `retryAt` after the customer's latest message plus 24 hours, Then the draft is "failed" with `fail_window_closed` at once, no timer is set, and the owner is told. Given the window closes between the 429 and the retry, Then the retry ends in `fail_window_closed` and publishes `window_closed`.
  - FR-DRAFTS-03-7: Given a second 429 at the retry, Then it queues again, `attempts` is 2, the send id is `<id>:2` next, and the window check runs each time.
  - FR-DRAFTS-03-7: Given the draft changed after the 429 (the fake edits its text in the store), Then the retry holds with `draft_changed`. Given the process is not the owner, Then `RetrySend` returns `skipped`.
- **Build:** `application/retry-send.ts`, the `rate_limited` branch of `driveSend`.
- **Done when:** `bun test test/drafts/acceptance/retry-send.test.ts` and `bun run typecheck` pass.

### Task 6: Recovery, resolving unknown sends and redriving orders
- **Tests first:** `test/drafts/acceptance/recovery.test.ts`, layer UC.
  - FR-DRAFTS-03-8: Given a draft left "sending" with no `retryAt` (built through the repository), When `RecoverInterrupted` runs, Then it is "unknown" with a log entry of reason `session_ended` and `toUnknown` is 1. Given a "sending" draft with `retryAt`, Then it is not unknown and `RetryScheduler.schedule` is called with `max(retryAt, now)`.
  - FR-DRAFTS-03-8: Given a draft left "recording" and `OrderRecorder.record` answering `outcome_unknown`, When `RecoverInterrupted` then `RedriveRecording` run, Then the draft is "unknown" with `order_outcome_unknown`, `RedriveRecording` counts it in `unknown`, and a second restart does not call `record` again.
  - FR-DRAFTS-03-13: Given an unknown reply draft and one matching message in the window (`FakeOutgoingFinder` answers `found` and links it), When `ResolveUnknownSends` runs, Then the draft is "sent", the log has `sent` with reason `found_after_unknown` pointing to the approval entry, and the next draft for the chat is not held as "owner answered".
  - FR-DRAFTS-03-13: Given no match after catch-up, Then the draft stays "unknown", the owner sees it as unknown, and nothing is sent again without a new go. Given two same-text messages (`ambiguous`), Then nothing is linked and it stays unknown. Given `partial`, Then it stays unknown.
  - FR-DRAFTS-03-8: Given `RecoverInterrupted`, `ResolveUnknownSends` and `RedriveRecording` called as `main.ts` orders them, Then a draft left "sending" by a dead owner is "unknown" before any catch-up call is made (the fake records the order).
  - FR-DRAFTS-03-13: Given the process is not the owner, Then each of the three use cases changes nothing and returns zeros.
  - FR-DRAFTS-03-13: Given a draft left "sending" (built through the repository, as after a `sent` write that failed) and a matching message in the chat, Then `RecoverInterrupted` turns it into "unknown" and `ResolveUnknownSends` links the message and writes `sent`. The three-try write itself is tested in SPEC-04 Task 6.
- **Build:** `application/{recover-interrupted,resolve-unknown-sends,redrive-recording}.ts`, the wiring in `src/drafts/index.ts` and `src/main.ts` (recovery order and the `CatchUpFinished` subscription on `InProcessEventBus`).
- **Done when:** `bun test test/drafts/acceptance/recovery.test.ts` and `bun run typecheck` pass.

### Task 7: End to end and crash tests
- **Tests first:** `test/drafts/acceptance/safe-send.e2e.test.ts` (layer E, the server over stdio with the fake Kapso server of the foundation) and `test/drafts/acceptance/crash.test.ts` (layer X, real processes on one data folder).
  - FR-DRAFTS-03-5: Given an owner reply from the app that the fake Kapso returns an outbound echo after the draft, When `approve_draft` is called, Then the answer is `held` with `owner_answered`, the owner's reply appears inside an `<owner_app_reply>` block, the three choices are listed, and the fake Kapso received no send.
  - FR-DRAFTS-03-9: Given the fake Kapso reports Deputy's message before Intake has the send id and then again later, When both have arrived, Then the chat read through `get_chat` holds one message with source "sent through Deputy" and the next draft is not held.
  - FR-DRAFTS-03-10: Given the provider reports the sent message again later, Then `get_chat` still shows one message.
  - FR-DRAFTS-03-2: Given the fake Kapso refuses the chat read with 503, Then `approve_draft` answers `held` with `catch_up_failed` and the fake received no send.
  - FR-DRAFTS-03-7: Given the fake Kapso answers the send with 429 and `Retry-After: 2`, Then `approve_draft` answers `queued`, and within the test timeout the message is sent once after a fresh check.
  - FR-DRAFTS-02-12: Given the process is killed after the send request reached the fake Kapso and before the answer (the fake holds the answer until the test releases it), When a new process starts on the same data folder and takes the lease, Then `list_drafts` shows the draft as "unknown" and the fake Kapso received no second send. The fake Kapso does not list a held, unanswered send in its outbound listing, so `ResolveUnknownSends` finds no match and the draft stays "unknown".
  - FR-DRAFTS-03-8: Given owner A killed mid-send and process B started, When B takes the lease (within 30 seconds, the lease time of ADR-002), Then the draft is "unknown" before B's first catch-up. Given a session killed after the provider accepted, Then at restart the draft is "unknown" and `ResolveUnknownSends` links it after the first catch-up and shows "sent".
  - FR-DRAFTS-03-7: Given the process stops while a send is queued, Then at the next start the draft is re-scheduled at `max(retry_at, now)` and runs every check; a "sending" draft with no `retry_at` becomes "unknown".
  - FR-DRAFTS-03-8: Given a draft left "recording" at a crash and `RecordOrder` answering `outcome_unknown` at restart, Then the draft is "unknown", and a second restart does not call `RecordOrder` again.
- **Build:** the MCP rendering, the `main.ts` wiring `kill()` in `test/support/harness.ts` and the gate in `test/support/fake-kapso-server.ts`.
- **Done when:** `bun test test/drafts test/architecture` and `bun run typecheck` pass.

## Out of scope

- Intake's behavior behind its ports (the send id link, echo reclassification, `FindOutgoing` matching, the `OUTGOING_SKEW` window): Intake's specs. The e2e tests here only observe it through the fake Kapso.
- Notify's turning of `SendNeedsOwner` into a notice: Notify's spec.
- The log tools, `check_approvals`, the gap list and the retry of a failed `sent` write: SPEC-04.
- The real Orders adapter for `OrderRecorder`: Orders has no spec.
