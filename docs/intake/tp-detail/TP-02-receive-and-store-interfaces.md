# TP-02-receive-and-store: Interfaces

Part of [TP-02-receive-and-store.md](../tp/TP-02-receive-and-store.md). Moved verbatim from there; nothing changed.

## Interfaces

Inbound ports (use cases):

```ts
export interface ReceiveLiveDelivery {
  execute(req: { rawBody: Uint8Array; headers: ReadonlyMap<string, string> }): Promise<
    | { kind: "stored"; stored: number; duplicates: number; ignored: number }
    | { kind: "rejected"; reason: RejectionReason }
    | { kind: "storage_failed" }
    | { kind: "live_off" }
    | { kind: "refused"; reason: "not_owner" }
  >;
}
```

Listener mapping: `stored` 200; `rejected` 401 (`malformed` 400); `storage_failed` 500; `live_off` 404; `refused` 503. A batch where some items lack an id stores the others, writes one note per bad item and returns `stored`. The `X-Idempotency-Key` header is not used: the provider message id already de-duplicates.

`ReceiveLiveDelivery` steps: lease check; policy (dev, or Kapso with `receiving = live`; otherwise `live_off`); secret present, else note `no_secret`; signature header present, else `missing_signature`; `Provider.verifyAndParse`; for each event, `StoreMessages` in one transaction; publish `MessageStored` after commit.

```ts
export interface ListRejections {
  execute(): Promise<{
    notes: ReadonlyArray<{ at: Instant; reason: RejectionReason; recoverable: boolean; resolved: boolean }>;
    prunedCount: number;
    unrecovered: number;
  }>;
}

export interface ChatStateView {
  chat: ChatId; mark: Mark;
  lastCustomerAt: Instant | null; lastCustomerMessageId: MessageId | null;
  lastAnswerAt: Instant | null; lastAnswerSource: "owner_app" | "sent_through_deputy" | null;
  lastUnattributedAt: Instant | null;
  profileName?: string;      // the provider's profile name: untrusted customer text, a display hint only; consumers escape and label it and never match on it
}
export interface ChatView {
  chat: ChatId;
  mark: Mark;
  messages: ReadonlyArray<MessageView>;     // sent order
}
export interface MessageView {
  id: MessageId; chat: ChatId; sender: string | null; type: string; readable: boolean;
  text: string | null; transcript: string | null; readerText: string;
  sentAt: Instant; storedAt: Instant; source: Source; history: boolean; dev: boolean;
  edited: boolean; previousTexts: readonly string[]; deletedBySender: boolean; mark: Mark;
}
export interface ReadChat      { execute(q: { chat: ChatId; limit?: number; storedSince?: Instant }): Promise<ChatView | null> }
export interface ChatExists    { execute(q: { chat: ChatId }): Promise<{ exists: boolean; hasNonDevMessage: boolean; activeWorldIsDev: boolean }> }
export interface IsCustomerText { execute(q: { text: string }): Promise<{ matches: boolean }> }
export interface ListChats     { execute(q: { customerMessageSince?: Instant }): Promise<ChatStateView[]> }
export interface GetMessages   { execute(q: { ids: readonly MessageId[] }): Promise<MessageView[]> }   // pure read, no lease; each view carries its chat and source; unknown ids are absent
```

`IsCustomerText` (used by Drafts, FR-DRAFTS-02-6) is true when `normalizeText(text)` equals the `text_norm` of any stored message with source `customer`, in any chat and either world. `normalizeText` is one function in `src/shared/`, defined once here and in Drafts TP-02 in the same words: (1) Unicode NFKC; (2) lower case; (3) every `\p{Nd}` digit becomes its ASCII digit (the value is the code point minus the first code point of its contiguous run of ten; NFKC already maps full-width and mathematical digits, but not Arabic-Indic, Persian or Devanagari ones); (4) every run of whitespace becomes one space; (5) leading and trailing characters in `\p{P}`, `\p{S}` or whitespace are removed (`/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu`), which covers Spanish `¡` and `¿`, full-width Chinese punctuation (NFKC turns `！` and `，` into ASCII, `。` into itself, all `\p{P}`) and emoji at the edges. Inner characters are never touched. Checked in Bun 1.4.4: `¡Hola, Ana!` gives `hola, ana`; `¿Cuánto cuesta?` gives `cuánto cuesta`; `أريد ٣ كيلو` gives `أريد 3 كيلو`; `！！好的，我要３个。。` gives `好的,我要3个`; `ok 👍` gives `ok`. Tests in es, ar and zh with these inputs are in the Testing section of each TP. Number tokens (Drafts) are runs of digits after step 3; a run is not a token when a decimal separator (`.`, `,`, Arabic `٫` or `٬`) joins it to another digit. Intake fills `text_norm` with it when it stores or edits a readable message, and Drafts calls the same function. It is a pure read (no lease). `MessageView.storedAt` is the local time Deputy stored the message; Drafts compares it as well as `sentAt`, because a late owner echo has an old `sentAt`.

`ChatExists.activeWorldIsDev` is true when the active provider is dev, so a caller can apply the rule "under a real provider the chat needs a non-dev message" (FR-DRAFTS-01-8) without knowing a provider name; the adapter test checks it for both providers. `ReadChat` never filters by the history flag and exposes `sentAt`, `storedAt` and `history` on every message; `lastAnswerAt` and `lastUnattributed` also count history messages, so Intake never hides a possible owner answer and Drafts applies its own rule. `ReadChat` without `limit` returns every message; with `limit` it returns the newest by sent order, and `storedSince` additionally returns every message stored at or after that time whatever its sent time, so a late echo is never hidden behind newer-sent messages. `ChatStateView` is `{ chat, mark, conversationRef, unattributedStoredAt, lastCustomerAt, lastCustomerMessageId, lastAnswerAt, lastAnswerSource }`. `ListChats` returns the world of the active provider only (TP-01, TD-2). `ReadChat` returns both worlds' messages for the chat, each marked `dev`. The pure reads do not ask for the lease. `ListChats` is not in the cross-cutting port list; Inbox needs it to find chats (see Open questions).

MCP tools (mapped, no new tool): `get_chat` (`chat`, optional `limit`) calls `ReadChat`; `rejected_deliveries` (no input) calls `ListRejections`. The MCP adapter wraps customer fields in `<customer_text>` blocks (cross-cutting Interfaces); Intake returns raw values and `readerText`.
