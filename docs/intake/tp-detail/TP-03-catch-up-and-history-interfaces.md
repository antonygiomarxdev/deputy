# TP-03-catch-up-and-history: Interfaces

Part of [TP-03-catch-up-and-history.md](../tp/TP-03-catch-up-and-history.md). Moved verbatim from there; nothing changed.

## Interfaces

Inbound ports:

```ts
export type SyncReason =
  | "not_yet_run" | "unreachable" | "credentials" | "quota" | "usage_limit" | "timeout"
  | "bad_response" | "possible_gap" | "catching_up" | "storage";

export interface SyncStatusView {
  provider: ProviderName;
  status: "complete" | "failed";
  reason: SyncReason | null;
  reasonText: string;                 // English default text of the fixed reason code, never provider text (D20)
  running: boolean;
  lastAttemptAt: Instant | null;
  lastSuccessAt: Instant | null;      // readers show "up to date as of <time>"
  newestStoredAt: Instant | null;
  oldestStoredAt: Instant | null;     // "history reaches back to ..." (FR-INTAKE-03-13)
  failedSince: Instant | null;        // readers announce a streak once, not every period
  retryAt: Instant | null;
  tellOwner: boolean;                 // false for usage_limit shorter than 10 minutes
  gap: { storedAt: Instant; returnedAt: Instant } | null;
  historyMaybeSyncing: boolean;       // first import complete with zero messages
  catchUpMinutes: number;
  storageFailureAt: Instant | null;   // from TP-02, in memory
  lastLiveDeliveryVerifiedAt: Instant | null;   // local time of the newest delivery whose signature passed (TP-02); Setup's live check reads it
}

export interface CatchUp {
  execute(q: { trigger: "start" | "timer" | "asked" | "retry"; waitMs?: number /* default 20000 */ }): Promise<
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

export interface GetSyncStatus { execute(): Promise<SyncStatusView> }      // pure read, no lease

export interface GetIntakeSettings { execute(): Promise<{ catchUpMinutes: number }> }

export interface SetIntakeSettings {
  execute(q:
    | { key: "catch_up_minutes"; value: number; ownerWords: string }
    | { key: "country"; value: string; ownerWords: string }      // ISO 3166-1 alpha-2; the default region for typed numbers (ADR-012)
  ): Promise<
    | { ok: true; value: number | string }
    | { ok: false; reason: "below_minimum" | "not_an_integer" | "not_owner"; minimum: 1; kept: number }
    | { ok: false; reason: "unknown_country" | "not_owner"; kept: string | null }
  >;
}

export interface CheckProviderAccess {
  execute(): Promise<
    | { ok: true; businessNumber: string | null }      // E.164, from Provider.businessNumber, when the provider offers it
    | { ok: false; reason: "credentials" | "unreachable" | "quota" | "usage_limit" | "timeout" }
  >;
}
```

`CheckProviderAccess` lists conversations with limit 1, then asks `Provider.businessNumber`, and writes nothing (cross-cutting TD-8). `SetIntakeSettings` with `country` checks the code through `PhoneNumberParser.isCountry` (the library stays behind that port, ADR-012) and refuses an unknown one with `unknown_country`, keeping the old value; the agent may write it after the owner says it, because it is not a trust boundary (cross-cutting TD-8).

`CatchUpChat` steps: lease; await the running run (bounded by `waitMs`, default 20 seconds); read that chat's conversation newest first until an item older than the chat's newest stored time minus the overlap; read one page of the outbound listing; store both through `StoreMessages`; return `ChatStateRepository.get`. With no stored `conversationRef`, it lists conversations active in the last 24 hours and takes the one whose counterpart equals the chat. A `rate_limited` error returns `failed`, reason `usage_limit`, with no wait.

`CatchUpFinished`:

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

MCP tools (existing, mapped): `check_messages` (no input) calls `CatchUp` with `trigger = asked` and returns the status text; `status` calls `GetSyncStatus` and Notify's status; `get_settings` and `set_setting` route `catch_up_minutes` to `GetIntakeSettings` and `SetIntakeSettings`. `set_setting` needs `owner_words`; it refuses `provider`, `receiving_mode` and `push_on` (cross-cutting TD-8).

Status wording (fixed), for example: unreachable "Could not reach Kapso."; credentials "Kapso did not accept the key. Check it where Setup put it."; quota "The Kapso message quota is used up."; usage_limit "Kapso asked me to slow down."; timeout "Kapso did not answer in time."; possible_gap "Some messages between <stored time> and <returned time> may be missing. Check the WhatsApp Business app for that period."; catching_up "Still catching up. Messages stored so far are kept."; storage "Deputy could not write to its storage." Each is followed by the newest stored time.

Adapter pacing (Kapso adapter): reads wait for the next provider minute when `remaining < 10`; sends skip this; a `429` throws `rate_limited` with `Retry-After`.
