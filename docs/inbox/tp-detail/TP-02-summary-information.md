# TP-02-summary: Information

Part of [TP-02-summary.md](../tp/TP-02-summary.md). Moved verbatim from there; nothing changed.

## Information

Inbox stores nothing in this FRD (FRD-02 Information). Domain values:

```ts
export interface DraftMark { number: number; kind: "reply" | "order"; state: "waiting" | "held" | "failed" | "unknown"; writtenAt: Instant; earlierSession: boolean }

export type Group = "needs_owner" | "orders" | "easy_questions";
export type NeedsOwnerReason =
  | "draft_held_owner_answered" | "draft_held_customer_wrote_again" | "draft_held"
  | "draft_send_failed" | "draft_outcome_unknown"
  | "order_recorded" | "no_draft" | "drafts_unavailable";

export const GroupAssigner: {
  assign(f: {
    marks: ReadonlyArray<DraftMark>; draftsChecked: boolean;
    orderHint: boolean; orderRecorded: boolean;
    lastCustomerAt: Instant; lastAnswerAt: Instant | null; lastAnswerSource: "owner_app" | "sent_through_deputy" | null;
  }): { group: Group; reasons: ReadonlyArray<NeedsOwnerReason> };
};

export type Excerpt =
  | { kind: "text"; text: string; cut: boolean }
  | { kind: "transcript"; text: string; cut: boolean }
  | { kind: "unreadable"; type: string; defaultText: string }   // defaultText is Intake's readerText
  | { kind: "unavailable" };                                      // the chat could not be read; the chat is still listed

export const EXCERPT_MAX_GRAPHEMES = 200;
```

Why 200 graphemes (answers FRD-02 open question 2). A one-sentence question or a short order line is under 120 characters; 200 holds a long one without cutting it. With 30 pending chats the excerpts add about 6,000 characters, a few thousand tokens, which is a list the agent can read and the owner can scan. The full text is one `get_chat` call away. The cut is on `Intl.Segmenter` grapheme boundaries (a global of Bun and V8, no import, no dependency), so an emoji or a letter with its marks is never split, and `cut: true` marks it. It is a domain constant, not a setting.

```ts
export interface WaitingRun { firstAt: Instant; latestAt: Instant; latestId: MessageId; latest: MessageFacts }
export const WaitingRun: { from(messagesAscending: ReadonlyArray<MessageFacts>): WaitingRun | null };
```

`WaitingRun.from` walks from the newest message back over messages that are not `dev` and have mark `normal`, collects the consecutive messages with source `customer`, and stops at the first message with another source. `firstAt` is the send time of the oldest in that run, so the waiting time counts from the first message after the answer (FRD-01 edge case), and `latest` gives the excerpt. The use case reads the chat tail with `ReadChat({ chat, limit: 50 })`; if the run reaches the oldest message returned and 50 were returned, it reads again without a limit. Why 50: a run of more than 50 unanswered messages is rare, so the second read is rare, and 50 rows is one small read.

`ReadInbox` result.

```ts
export type PendingItem = {
  chat: ChatId;                      // customer text (a number; group:<id> is provider text)
  profileName?: string;              // customer text, untrusted display hint from Intake; cut at 80 graphemes by Intake (owner decision D28; the same `Intl.Segmenter` rule as the excerpt); absent when Intake has none
  group: Group;
  followsAnswer: boolean;            // an answer exists before the waiting run; the agent may skip a closing "ok" or "thanks" only when sure, else asks (D23)
  reasons: ReadonlyArray<NeedsOwnerReason>;        // only for needs_owner
  waitingSince: Instant; waitingSeconds: number;
  latestMessageId: MessageId; latestMessageAt: Instant;
  excerpt: Excerpt;
  draft: { number: number; kind: "reply" | "order"; state: DraftMark["state"]; earlierSession: boolean } | null;   // number, kind, state and the earlier-session mark only, never text (D25)
  orderRecorded: boolean;
};
export type AnsweredItem = {
  chat: ChatId; profileName?: string; answeredAt: Instant;
  drafts: ReadonlyArray<{ number: number; kind: "reply" | "order"; state: DraftMark["state"]; stale: boolean }>; // stale: made before the owner's answer
};
export type InboxWarning = { code: SyncReason | "not_refreshing" | "drafts_unavailable" | "orders_unavailable"; defaultText: string; newestStoredAt?: Instant | null };
export type CountLine =
  | { code: "ignored_chats"; ignored: number; withUnanswered: number; defaultText: string }
  | { code: "outside_window"; chats: number; windowDays: number; defaultText: string }
  | { code: "not_handled_messages"; messages: number; defaultText: string };
export type InboxResult = {
  asOf: Instant | null;              // Intake lastSuccessAt (FR-INBOX-02-16)
  newestStoredAt: Instant | null;
  refresh: "reused" | "ran" | "running" | "failed" | "not_owner";
  warnings: ReadonlyArray<InboxWarning>;
  windowDays: number;
  nothingPending: boolean;
  groups: { needsOwner: PendingItem[]; orders: PendingItem[]; easyQuestions: PendingItem[]; answeredByOwner: AnsweredItem[] };
  counts: ReadonlyArray<CountLine>;  // a line only when its count is above zero
  unknownHints: ReadonlyArray<ChatId>; // order_chats entries that are not pending chats; ignored, reported
};
```

The default texts are English and carry numbers only, never customer text (D20). `SyncReason` is Intake's published union; its `reasonText` is the `defaultText` of a sync warning.

`ReadInbox` steps:

1. Refresh (TD-2). Build the sync warning when the status is `failed`, when the run is still going (`catching_up`), or when `historyMaybeSyncing` is true (code `history_may_be_syncing`, a field of Intake's status). It carries `newestStoredAt`.
2. `ChatScanner.scan()` (TP-01) with no listing filter, because the answered group and the outside-window line need older chats.
3. Read Drafts' waiting list once. On failure set `draftsChecked = false` and add warning `drafts_unavailable`.
4. For each pending chat: read its tail, build `WaitingRun` and `Excerpt`. If the read is null or the run is empty, keep the chat with `Excerpt.unavailable` and `waitingSince = lastCustomerAt`. A pending chat is never dropped (R-INBOX-4).
5. For chats that have an order draft waiting or are in `order_chats`, ask Orders once, in one batch, `isMessagesRecorded(latestMessageIds)`. Other chats cannot be offered as orders, so they are not in the batch. One call per `ReadInbox` matters because a spreadsheet store reads the whole tab per call (60 reads per minute per user, Orders TP-01). When the batch is empty, no call is made. When Orders answers `ok: false` or throws, add warning `orders_unavailable` and treat none as recorded.
6. `GroupAssigner.assign` for each chat, then sort each group by `waitingSince` ascending, ties by `ChatId` (FR-INBOX-02-11).
7. Answered group: chats judged `answered` with `by = owner_app`, `lastCustomerAt` not null, `answeredAt >= answeredSince`, not ignored. `answeredSince` is the tool input, else `windowStart`. Each carries its open drafts with `stale = writtenAt < answeredAt`.
8. Build count lines from the scan (ignored from TP-03's list, outside window, not handled messages).

Ignored chats appear in no group; only the count line shows them (FR-INBOX-03-4, FR-INBOX-03-5).

SQL. None. Inbox reads Intake's tables only through Intake's ports.
