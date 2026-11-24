# TP-01-providers: Interfaces

Part of [TP-01-providers.md](../tp/TP-01-providers.md). Moved verbatim from there; nothing changed.

## Interfaces

Outbound port `Provider` (`src/intake/ports/provider.ts`). Every method takes an `AbortSignal`; the adapter aborts a request after 15 seconds and throws `timeout`.

```ts
export type ProviderName = "kapso" | "dev";
export type Cursor = string & { readonly __cursor: true };

export interface Page<T> {
  items: readonly T[];        // newest first
  next: Cursor | null;        // null: the listing is exhausted
  serverTime: Instant;        // provider clock, from the response Date header
  remaining: number | null;   // requests left in the current window, null if unknown
}

export interface ProviderConversation {
  ref: string;                // provider conversation id
  counterpart: string | null; // customer number or group id, raw
  group: boolean;
  lastActiveAt: Instant;
}

export interface ProviderMessage {
  providerMessageId: string | null; // null only in a live delivery that lacks it
  conversationRef: string | null;
  from: string | null;              // raw sender number, null when the provider gives none
  counterpart: string | null;       // the other party: the customer number or group id
  direction: "inbound" | "outbound";
  type: string;                     // as the provider names it; "unknown" when absent
  text: string | null;
  transcript: string | null;
  sentAt: Instant;                  // provider time
  origin: string | null;            // kapso.origin, kept as information (FR-INTAKE-04-12)
  group: boolean;
  edited: boolean;                  // the provider says this text is an edit
  profileName: string | null;       // the sender's profile name when the provider gives one; untrusted customer text
  devOwnerMark: boolean;            // true only from the dev adapter
}

export type ProviderEvent =
  | { kind: "message"; message: ProviderMessage }
  | { kind: "edit"; providerMessageId: string; text: string }
  | { kind: "delete"; providerMessageId: string }
  | { kind: "ignored"; reason: "reaction" | "receipt" };

export type ParsedDelivery =
  | { kind: "ok"; events: readonly ProviderEvent[] }
  | { kind: "no_secret" } | { kind: "missing_signature" }
  | { kind: "bad_signature" } | { kind: "malformed" };

export type ProviderErrorKind =
  | "unreachable" | "credentials" | "quota" | "rate_limited" | "timeout" | "bad_response";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly retryAfterMs: number | null,      // set for rate_limited
    readonly mayHaveBeenAccepted: boolean,     // false for a refusal; true for a timeout or dropped connection on a send
  ) { super(kind); }
}

export interface Provider {
  readonly name: ProviderName;
  listConversations(
    q: { activeAfter: Instant | null; cursor: Cursor | null; limit: number },
    signal: AbortSignal,
  ): Promise<Page<ProviderConversation>>;
  listMessages(
    q: { scope: { conversationRef: string } | { outbound: true }; cursor: Cursor | null; limit: number },
    signal: AbortSignal,
  ): Promise<Page<ProviderMessage>>;
  /** One part of at most 4000 UTF-16 code units (`MAX_PART`, Intake TP-04). The caller splits. */
  sendText(
    req: { to: PhoneNumber; text: string },
    signal: AbortSignal,
  ): Promise<{ providerMessageId: string; serverTime: Instant }>;
  verifyAndParse(req: {
    rawBody: Uint8Array;
    headers: ReadonlyMap<string, string>; // names lower-cased
    secret: string | null;
  }): ParsedDelivery;
  /** The connected business number, when the provider offers it (the Kapso phone-number record); null otherwise. */
  businessNumber(signal: AbortSignal): Promise<PhoneNumber | null>;
}
```

Notes on the contract:

- `listMessages` with `{ outbound: true }` is the number's outbound listing (`direction=outbound`); Kapso also needs `phone_number_id`, which the adapter holds. Pages hold at most 100 items.
- The adapter reads `X-RateLimit-Remaining` into `remaining` and turns `429` into `ProviderError("rate_limited", Retry-After, false)`. Pacing is in the Kapso adapter (TP-03, TD-2).
- `ProviderError("credentials")` is a `401` or `403`; `quota` is the monthly message limit reported by the provider; any non-JSON or wrong-shape body is `bad_response`.
- The dev adapter reads `dev_holdings`, sets `serverTime` from the `Clock`, never rate limits, and its `verifyAndParse` uses the fixed dev secret.

- `businessNumber` serves `CheckProviderAccess` (TP-03): the Kapso adapter reads the number of the configured `phone_number_id` and the dev adapter returns null. A failure maps to the same `ProviderError` kinds. The number is public to the owner and is not a secret.

Outbound port for settings:

```ts
export interface IntakeConnectionConfig {
  read(): Promise<{
    provider: string | null;                 // raw value from config.json
    receivingMode: string | null;            // raw value: "catch-up" or "live"
    kapso: { apiKey: Secret | null; phoneNumberId: string | null; webhookSecret: Secret | null };
  }>;
}
```

`Secret` is a class whose `toString()`, `toJSON()` and inspection output are `"[secret]"`; `reveal()` returns the value. It never reaches a log (cross-cutting threat model). The Kapso phone number id is the connection setting `kapso_phone_number_id` in `config.json`, set with `deputy config set kapso-phone-number-id <id>` like the other connection settings (cross-cutting TD-8); Setup shows the command.

Inbound port (use case), run by `main.ts` at start, not an MCP tool:

```ts
export interface ResolveProviderSettings {
  execute(): Promise<
    | { ok: true; provider: ProviderName; receiving: "catch_up" | "live"; notices: string[] }
    | { ok: false; message: string }
  >;
}
```

Rules, in order:

1. `provider` empty or absent: dev, notice "no provider set, using dev". `provider` not `kapso` or `dev`: refuse with "provider must be kapso or dev, got '<value>'" (FR-INTAKE-01-1; the value is echoed because it is the owner's own setting, never customer data).
2. `provider = kapso` and the API key, the phone number id, the webhook secret when `receiving_mode = live`, or an owner number (the business number) is missing: refuse with a message that lists each missing item and says "run Setup" (FR-INTAKE-01-8). Values never appear.
3. `receiving_mode` empty: `catch_up`. `live` with dev: ignored, dev entry points are always on. Any other value: refuse and list `catch-up` and `live`.

Dev entry points (inbound adapter, only when the provider is dev; bodies are JSON, loopback only):

| Route | Does | Result |
|---|---|---|
| `POST /dev/deliver` | builds a delivery from `{ chat, from, text, type?, transcript?, sentAt?, owner? }`, copies it into `dev_holdings`, signs it with the dev secret, calls `ReceiveLiveDelivery` | the use case result; a missing `chat` or `from` returns 400 naming the field and stores nothing (edge case). `owner: true` sets the owner mark, used only when no owner number is configured (TP-04) |
| `POST /dev/hold` | writes the same payload into `dev_holdings` only | 204; the next catch-up stores it (FR-INTAKE-01-6) |
| `POST /dev/forge` | the `deliver` body with a missing or wrong signature, or no secret | rejection result; used for FR-INTAKE-01-5 |

Setup's test mode (no WhatsApp account, FR-SETUP-04-7) cannot use HTTP, so the same path is an inbound port, `DeliverDevMessage`, called only by Setup's `setup_test_message` adapter. It is not an MCP tool of Intake, and `/dev/deliver` calls it too:

```ts
export interface DeliverDevMessage {
  execute(q: { chat: string; from: string; text: string }): Promise<
    | { ok: true; result: "stored" | "duplicate" }
    | { ok: false; reason: "not_dev" | "invalid_chat" | "invalid_from" | "storage_failed" }
  >;
}
```

It builds the delivery as `/dev/deliver` does (copy into `dev_holdings`, dev signature, `ReceiveLiveDelivery`). Under any other provider it answers `not_dev`, stores nothing and writes a rejection note `dev_entry_refused` (L3, FR-INTAKE-01-9), so no real chat can receive an injected message. `chat` and `from` are a fictional chat and number: they must parse, and a real number is not detected, so the dev world is the guard (a dev message is never visible under a real provider, FR-INTAKE-01-7).

The same body sent twice, or with a repeated `providerMessageId`, tests repeats; `sentAt` in reverse order tests ordering; `history: true` sets `origin = history_sync`.

Kapso adapter mapping (inbound to `ProviderMessage`): `message.id` to `providerMessageId`; `conversation.id` to `conversationRef`; `message.kapso.direction` to `direction`; `message.kapso.origin` to `origin`; `message.type` to `type`; `message.text.body` to `text`; `message.kapso.transcript.text` to `transcript` when present; the counterpart is `to` for outbound and `from` for inbound; `from` is the raw sender; a group is a conversation or message that the platform marks as a group. Field paths that the research did not confirm are listed in Open questions.
