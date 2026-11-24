# TP-01-batched-notice: Interfaces

Part of [TP-01-batched-notice.md](../tp/TP-01-batched-notice.md). Moved verbatim from there; nothing changed.

## Interfaces

Value types:

```ts
// src/notify/domain/Notice.ts
export type Caveat = "waiting_may_be_incomplete" | "may_include_ignored";
export type OutageReason = "unreachable" | "timeout" | "credentials" | "quota" | "usage_limit" | "bad_response";

export type Notice =
  | { code: "new_messages"; messages: number; chats: number; otherWaiting: number; caveats: Caveat[] }
  | { code: "reminder"; waiting: number; caveats: Caveat[] }
  | { code: "provider_unreachable"; since: Instant; reason: OutageReason }
  | { code: "provider_reachable" }
  | { code: "send_needs_owner"; reason: SendNeedsReason };   // TP-03: urgent, one per event, no counts
export type SendNeedsReason = "held_after_retry" | "window_closed" | "retry_failed" | "owner_reply_unlinked";
```

A `Notice` has no `string` that can come from outside: codes and caveats are closed unions, the rest are numbers and one instant. FR-NOTIFY-01-5 holds by type. The `Notice` has no field for a chat.

Default text (English, filled with numbers; the agent says it in the owner's language):

| Code | Default text |
|---|---|
| `new_messages` | `3 new messages from 2 chats. 5 other chats are still waiting. Ask what is pending.` One of each: `1 new message from 1 chat.` When `otherWaiting` is 0 the second sentence is left out. |
| `reminder` | `5 chats are still waiting for an answer. Ask what is pending.` |
| caveat `waiting_may_be_incomplete` | adds ` The waiting count may be incomplete.` |
| caveat `may_include_ignored` | adds ` The count may include ignored chats.` |

Inbound ports (published in `src/notify/index.ts`):

```ts
export interface MessagesStoredHint {
  origin: "live" | "catch_up";
  items: ReadonlyArray<{ chat: ChatId; source: "customer" | "owner_app"; count: number }>;
  at: Instant;
}

export interface OnMessagesStored {          // event handler; never throws
  execute(h: MessagesStoredHint): Promise<void>;
}

export type TickResult =
  | { kind: "skipped"; reason: "not_owner" }
  | { kind: "idle"; reason: "notices_off" | "push_off" | "push_unsupported" }
  | { kind: "quiet" }
  | { kind: "retrying" }
  | { kind: "nothing_due" }
  | { kind: "sent"; code: Notice["code"] }
  | { kind: "failed"; code: Notice["code"]; reason: "no_session" | "write_error" };

export interface Tick { execute(): Promise<TickResult> }

export interface StartNoticeSession { execute(): Promise<void> }   // LeaseSupervisor, on every lease acquisition
```

`OnMessagesStored` ignores items whose source is `owner_app` (FR-NOTIFY-03-1), ignores everything when notices are off or push is not ready, adds `count` for each customer item, and sets `batchStartedAt` when the set was empty. It asks the lease. It never reads message text because the hint holds none.

Outbound ports (all return Promises, `src/notify/ports/`):

```ts
export interface WaitingCounts {                         // adapter: Inbox CountWaiting (published, pure read, no lease)
  snapshot(): Promise<{ chats: ReadonlyArray<ChatId> }>; // pending chats, NOT ignored; no text, no names. Throws InboxReadFailed (code "inbox_read_failed")
}
export interface SyncStatusReader {                      // adapter: Intake GetSyncStatus
  read(): Promise<{ status: "complete" | "failed"; reason: string | null; failedSince: Instant | null;
                    tellOwner: boolean; catchUpMinutes: number }>;
}
export interface Notifier {                              // adapters: Claude channel, null
  availability(): "off" | "unsupported" | "ready";       // off: push_on is false; unsupported: the client did not declare claude/channel
  deliver(e: NoticeEnvelope): Promise<{ kind: "delivered" } | { kind: "failed"; reason: "no_session" | "write_error" }>;
}
export interface NoticeEnvelope {
  text: string;                                          // the English default
  meta: Record<string, number | string>;                 // keys: letters, digits, underscores (channel contract); values: code, numbers, caveat codes, one ISO instant
}
export interface NoticeRepository { load(): Promise<NoticeState>; save(s: NoticeState): Promise<void> }
```

`Clock` and `OwnerLease` come from `src/shared/`. The settings and calendar ports are in TP-02.

MCP tools: this FRD adds none. `status` shows notices (TP-03). The tools of TP-02 set the values this TP uses.
