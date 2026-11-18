# Technical Proposal: FRD-02 Owner controls

Status: Approved (2026-11-18)

Per-FRD TP for [FRD-02](../frd/FRD-02-owner-controls.md). It builds on [TP-01](TP-01-batched-notice.md) (the `Tick` steps, `Notice`, the ports) and on the cross-cutting [TP.md](../../../../docs/tp/TP.md): TD-3 (SQLite `settings` table), TD-7 (time zone default, quiet periods), TD-8 (settings the owner changes by talking, `set_setting` routing). It does not change them.

## Context

Fixed by the cross-cutting TP (no TD here):

- Settings live in the shared `settings(key, value, changed_at)` table. Notify owns six keys: `batch_minutes`, `reminder_minutes`, `reminders_paused`, `quiet_periods`, `time_zone`, `notices_on` (TD-8). The MCP tools `get_settings` and `set_setting` route by key to the owning slice. No tool is added.
- Setting a value needs `owner_words` and the lease (TD-2, TD-8). `push_on` is not a Notify setting. It is a connection setting changed only from the terminal (TD-8), so `set_setting` refuses it and names `deputy config set push on`.
- `time_zone` defaults to the system zone, read once at first start and stored (TD-7). Quiet periods are wall-clock hours in that zone, never a fixed offset (TD-7, D20 for language; many owners, many zones).
- The ignore list belongs to Inbox (FR-NOTIFY-02-6). Notify reads it on every notice through Inbox's `CountWaiting`, which already leaves ignored chats out and reads the ignore list live from the database (FR-NOTIFY-02-10) and keeps no table, no cache and no log of it. A cache would go stale after an ignore command and survive nothing a read does not.
- Ranges come from the FRD: batching 1 minute to 24 hours (1440 minutes), reminders 5 minutes to 24 hours (FR-NOTIFY-02-4).

Ignored-chat rule in `Tick` (completes TP-01 step 6.2): the waiting snapshot already excludes ignored chats. If `WaitingCounts.snapshot()` throws (Inbox cannot read its storage or Intake), nothing can be filtered: a batch notice leaves no chat out, counts every hinted chat as new, omits `otherWaiting` and carries both caveats `may_include_ignored` and `waiting_may_be_incomplete` (FRD-02 edge case). A notice that might count an ignored chat costs the owner less than a notice about a real customer arriving late. A reminder needs the snapshot, so it is skipped and retried at the next tick.

Facts checked for this TP (Bun 1.4.4, Windows, from source and from a `bun build --compile` binary): the minute-of-day of an instant in a zone, read with `Intl.DateTimeFormat`, gives the DST results of the cross-cutting TP: for quiet 22:00 to 07:00 in America/New_York, a scan from `2026-03-08T03:00Z` ends at `2026-03-08T11:00Z` (8 real hours) and a scan from `2026-11-01T02:00Z` ends at `2026-11-01T12:00Z` (10 real hours). An invalid zone throws `RangeError`. 1440 formatter calls took 4 ms. `Temporal` is also a global in Bun 1.4.4 and handles a gap (`01:30` moved to `02:30` gives `03:30-04:00`), but I could not check its TypeScript types: the `typescript` 7.0.2 package here has no `lib` folder to inspect.

## Requirements served

FR-NOTIFY-02-1, FR-NOTIFY-02-2, FR-NOTIFY-02-3, FR-NOTIFY-02-4, FR-NOTIFY-02-5, FR-NOTIFY-02-6, FR-NOTIFY-02-7, FR-NOTIFY-02-8, FR-NOTIFY-02-9, FR-NOTIFY-02-10.

## Decisions

### TD-1: Where do the setting rules live?

- **Option A** A typed `NotifySettings` aggregate in the domain. Value objects `BatchPeriod`, `ReminderPeriod`, `QuietSchedule` and `TimeZoneName` each validate on creation and carry the range. `SetNotifySettings` builds the value object and the aggregate saves. Cost: four small classes. Risk: more files than a validation table.
- **Option B** A generic key and value check in the MCP adapter (zod ranges per key), with the settings table read as raw strings by `Tick`. Cost: the least code. Risk: the rules sit in the one adapter that tests need a server for, so the FRD tests (range refused, old value kept, quiet period crossing midnight) cannot run without it. A second inbound adapter (the future CLI or a spreadsheet import) would copy the rules.

Chosen: Option A. It follows TD-0: the FRD's Given/When/Then lines run with in-memory adapters. The MCP adapter still parses the wire shape with zod (strings to numbers, `HH:MM` to minutes), but no range lives there. Recorded in ADR-004.

### TD-2: How is local time read for quiet periods?

- **Option A** A `LocalCalendar` outbound port with an adapter over `Intl.DateTimeFormat` (a platform API, no package). The domain asks only `minuteOfDay(at, zone)`. A pure `QuietSchedule` finds the end of a quiet stretch by stepping forward one minute at a time until no period covers the minute (at most 1440 steps, 4 ms measured). The schedule refuses a union that covers all 1440 minutes (`always_quiet`), so the scan always ends. Cost: a small scan the domain owns. Risk: the step assumes whole-minute UTC offsets, true for every zone in use today.
- **Option B** The `Temporal` global that Bun 1.4.4 provides. Cost: no scan; `ZonedDateTime.with` and disambiguation handle gaps and folds. Risk: I could not check its TypeScript types here, so `bun run typecheck` may fail or need a cast; and it would make the domain depend on a global whose support in Bun is newer than `Intl`. The cross-cutting TP already verified `Intl.DateTimeFormat` for DST in Bun (TD-7).
- **Option C** A library (`luxon`, `date-fns-tz`, `temporal-polyfill`). Cost: a dependency and bundle size. Risk: `luxon` and `date-fns-tz` use `Intl` underneath, so they add code for two functions (minute of day, system zone) that `Intl` gives directly.

Chosen: Option A. It needs nothing new, is already verified for the spring and fall DST days of the cross-cutting TP, and the port keeps Option B one adapter away if the types are later checked. Quiet periods are stored as minutes of the day, never as UTC. Recorded in ADR-005.

## Architecture

Same hexagon as TP-01. This TP adds:

- Domain: `NotifySettings` (aggregate: `batch`, `reminder`, `remindersPaused`, `quiet: QuietSchedule`, `timeZone`, `noticesOn`), `BatchPeriod`, `ReminderPeriod`, `QuietSchedule`, `QuietPeriod`.
- Application: `GetNotifySettings`, `SetNotifySettings`. `Tick` and `OnMessagesStored` read settings at the start of each call, so a change applies from the next period (FR-NOTIFY-02-1).
- Ports: `NotifySettingsRepository`, `LocalCalendar`.
- Adapters: `sqlite/SqliteNotifySettingsRepository` (the `settings` table, Notify's keys only), `calendar/IntlLocalCalendar`.

Rules in the domain:

- `QuietPeriod { startMinute, endMinute }`, each 0 to 1439 and not equal. `start > end` crosses midnight and is one period (FRD-02 edge case): minute `m` is inside when `m >= start || m < end`; otherwise when `start <= m < end`.
- `QuietSchedule.contains(at, zone, cal)` is true when any period contains `cal.minuteOfDay(at, zone)`. `QuietSchedule.endOf(at, zone, cal)` steps from the start of the current minute, one minute at a time, to the first minute no period contains. It is only called when `contains` is true.
- At most 8 periods per schedule. Each stored entry is about 30 bytes of JSON, so the cap keeps the value under 300 bytes and the agent's answer short. It is a size bound, not a product rule. Eight covers a night plus several breaks in a day; the limit can be raised in one constant.
- Quiet affects `Tick` at step 3 (TP-01): in quiet nothing is sent, pending counts are kept, and the batch is due at the first tick after the end. That gives "one notice at the end of the later of the two" (edge case) and "a reminder in a quiet period is sent after it ends, if chats still wait". Counting happens at send time, so messages that arrived in quiet are all in one count (FR-NOTIFY-02-3).
- Notices off: step 2 of `Tick` drops pending counts and `OnMessagesStored` ignores hints. Turning notices back on starts with an empty set, so only later messages count as new and the waiting count is current (edge case). Reminders stop too (FR-NOTIFY-02-9). `reminders_paused` suppresses step 7 only.

## Information

Notify's keys in the shared `settings` table (no new table; `notice_state` is TP-01):

| Key | Value stored | Default | Range and reason |
|---|---|---|---|
| `batch_minutes` | integer | 10 | 1 to 1440 (FR-NOTIFY-02-4) |
| `reminder_minutes` | integer | 30 | 5 to 1440 (FR-NOTIFY-02-4) |
| `reminders_paused` | `true` or `false` | `false` | |
| `quiet_periods` | JSON array, `[{"start":1320,"end":420}]`, minutes of the local day | `[]` | at most 8 entries; the union must leave at least one minute free |
| `time_zone` | IANA name | none stored until first start; then the system zone | must be accepted by `LocalCalendar.isValidZone` |
| `notices_on` | `true` or `false` | `true` | |

```sql
-- the settings table is created by the cross-cutting migration; shown for reference
-- CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, changed_at TEXT NOT NULL);
```

`StartNoticeSession` (TP-01) stores the time zone on the first start: if the key is missing it reads `LocalCalendar.systemZone()` and saves it. A read-only process shows the system zone without saving.

Notify owns no table or column for ignored chats. A test lists the tables and columns that Notify's migration creates and fails if any name contains `ignor`.

## Interfaces

Inbound ports:

```ts
export type NotifyKey = "batch_minutes" | "reminder_minutes" | "reminders_paused" | "quiet_periods" | "time_zone" | "notices_on";

export interface NotifySettingsView {
  batchMinutes: number; reminderMinutes: number; remindersPaused: boolean;
  quietPeriods: ReadonlyArray<{ start: string; end: string }>;   // "HH:MM", 24 hour, local time of timeZone
  timeZone: string; noticesOn: boolean;
}

export interface GetNotifySettings { execute(): Promise<NotifySettingsView> }   // pure read, no lease

export type SetNotifyInput =
  | { key: "batch_minutes" | "reminder_minutes"; value: number; ownerWords: string }
  | { key: "reminders_paused" | "notices_on"; value: boolean; ownerWords: string }
  | { key: "quiet_periods"; value: ReadonlyArray<{ start: string; end: string }>; ownerWords: string }
  | { key: "time_zone"; value: string; ownerWords: string };

export type SetNotifyResult =
  | { ok: true; settings: NotifySettingsView }
  | { ok: false; reason: "out_of_range"; min: number; max: number; kept: number }
  | { ok: false; reason: "not_an_integer" | "invalid_time" | "too_many_periods" | "always_quiet" | "unknown_zone" | "unknown_key" | "wrong_type" | "owner_words_missing" | "owner_words_copied_from_customer" | "owner_words_unchecked" | "not_owner" };

export interface SetNotifySettings { execute(i: SetNotifyInput): Promise<SetNotifyResult> }
```

A refusal changes nothing and carries a code with an English default text (D20). The agent says the range in the owner's language. `kept` is the old value (FR-NOTIFY-02-4).

Outbound ports:

```ts
export interface CustomerTextCheck { isCustomerText(text: string): Promise<boolean> }   // adapter: Intake IsCustomerText; a throw refuses the change with `not_owner`-style safe failure `owner_words_unchecked`

export interface NotifySettingsRepository {
  load(): Promise<NotifySettings>;                 // defaults for missing keys; time zone may be null
  save(s: NotifySettings): Promise<void>;          // one transaction, only Notify's keys
}
export interface LocalCalendar {                    // adapter: Intl.DateTimeFormat
  systemZone(): string;                             // Intl.DateTimeFormat().resolvedOptions().timeZone
  isValidZone(zone: string): boolean;
  minuteOfDay(at: Instant, zone: string): number;   // 0 to 1439, hourCycle h23
  localParts(at: Instant, zone: string): { year: number; month: number; day: number; hour: number; minute: number };
}
```

MCP wire shape (the adapter in `src/adapters/mcp/`, zod):

| Tool | Notify part of the input | Output | Use case |
|---|---|---|---|
| `get_settings` | optional `key` among the six | `NotifySettingsView` plus the note `reminders_paused: true` when paused, so the agent tells the owner (edge case) | `GetNotifySettings` |
| `set_setting` | `key`, `value` (number, boolean, `[{start:"22:00", end:"07:00"}]` or an IANA name), `owner_words` | the new view, or the refusal code with default text, range and kept value | `SetNotifySettings` |

`set_setting` for `push_on` is refused by the MCP adapter with the code `terminal_only` and the command to run (cross-cutting TD-8); it never reaches Notify.

## Threat model

Assets: the owner's quiet hours and attention; the rule that only the owner changes settings.

| Attacker | Attack | What stops it | Accepted |
|---|---|---|---|
| A customer | Write "ignore my chat" or "turn off notices" hoping the agent obeys | Notify has no tool that takes customer text. `ignore_chat` and `set_setting` need `owner_words` (cross-cutting TP). Notify holds no ignore state at all, so a customer message cannot change it (FR-NOTIFY-02-6). | An agent can invent owner words (D11); settings are not a send path, and the log of the changing command is in the conversation. |
| A customer or an injected agent | Copy a customer message as `owner_words` to silence notices (`notices_on` false, `reminders_paused`, a 24 hour batch, quiet periods, `time_zone`) | `SetNotifySettings` asks the outbound port `CustomerTextCheck` (Intake `IsCustomerText`, the same port Inbox and Drafts use) and refuses `owner_words_copied_from_customer`. Same rule as Inbox ADR-009. | An agent can still invent words that no customer wrote (D11). |
| An injected agent | Set quiet 00:00 to 23:59 plus 23:59 to 00:00, or a 24 hour batching period, to silence notices | The schedule refuses a union that covers the whole day (`always_quiet`). The 24 hour limit is the FRD's. Silenced notices lose nothing: the inbox is the record (principle 3). | An owner can silence notices on purpose; `get_settings` shows it. |
| An injected agent | Change `time_zone` to move quiet hours | A zone must be a valid IANA name; the change is visible in `get_settings`. | A wrong zone shifts notices only. |
| A malformed value | A huge quiet array or a text that is not a time | The array holds at most 8 entries; a time must match `HH:MM` with hour 0 to 23 and minute 0 to 59. | None |

## Testing

| FR | Acceptance test | Layer |
|---|---|---|
| FR-NOTIFY-02-1 | Given the owner sets `batch_minutes` to 5 ("the owner says 5 minutes"), When messages arrive, Then the notice comes after 5 minutes, not 10; the change applies to the next period, not to a period already running. | UC |
| FR-NOTIFY-02-1 | Given no choice was made, When the settings are read, Then the batching period is 10 minutes. | UC |
| FR-NOTIFY-02-2 | Given a quiet period 22:00 to 07:00 in America/New_York, When a message arrives at 23:00 local time, Then no notice is sent. Given the clock jumps across 2026-03-08 and 2026-11-01 (fake `Clock` and the Intl adapter), Then the period ends at `11:00Z` and `12:00Z`, and both `01:30` instants of the fold day are quiet. | UC, AC |
| FR-NOTIFY-02-2 | Given the owner sets a period that crosses midnight, When a message arrives at 01:00, Then it is quiet (one period). Given two overlapping periods, Then the end is the end of the union. | UC |
| FR-NOTIFY-02-2 | Given Setup writes `time_zone` through `SetNotifySettings` with the owner's words, When the name is valid (`America/Managua`) it is saved; When it is not (`Mars/Base`) it is refused with `unknown_zone` and the old zone is kept. | UC, AC |
| FR-NOTIFY-02-3 | Given a quiet period and three messages from two chats during it, When the period ends, Then one notice counts all three. | UC |
| FR-NOTIFY-02-4 | Given `batch_minutes` 0, -5, 1441, 2.5, When the owner asks, Then each is refused with `out_of_range` (min 1, max 1440) or `not_an_integer` and the old value is kept; 1 and 1440 are accepted. Given `reminder_minutes` 4 refused and 5 accepted. | UC |
| FR-NOTIFY-02-5 | Given notices off, When messages arrive, Then they are stored (Intake in-memory) and the inbox lists them (E2E), no notice is sent and pending counts are not kept. Given notices turned on again, Then only later messages count as new. | UC, E2E |
| FR-NOTIFY-02-6 | Given a customer message "please ignore my chat", When it arrives, Then the chat is still counted; Notify exposes no use case, tool or table that writes an ignore entry. | UC, E2E |
| FR-NOTIFY-02-6 | Given Notify's migration, When its tables and columns are listed, Then none holds an ignore list. | AC |
| FR-NOTIFY-02-6 | Given every inbound port Notify publishes, When their input types are listed, Then none except `OnMessagesStored` (an Intake event, no text) takes a chat id or customer text, so no tool call or customer message can change what is ignored. | AC |
| FR-NOTIFY-02-1 | Given `owner_words` equal to a stored customer message (`IsCustomerText` true), When `SetNotifySettings` runs for any key, Then it is refused with `owner_words_copied_from_customer` and nothing changes. | UC |
| FR-NOTIFY-02-7 | Given a chat ignored in Inbox and messages in it, When the notice is built, Then it is absent from `messages`, `chats` and `otherWaiting`; the inbox still lists it (E2E). | UC, E2E |
| FR-NOTIFY-02-8 | Given the owner stops ignoring a chat in Inbox, When the next notice or reminder is built, Then the chat counts again as waiting. | UC |
| FR-NOTIFY-02-9 | Given reminders paused and an unanswered chat, When the reminder period passes, Then no reminder is sent; after `reminders_paused` is set to false, one is sent. A new-message notice still goes out while paused. | UC |
| FR-NOTIFY-02-9 | Given `reminder_minutes` 10 (and `batch_minutes` 5), When a chat stays unanswered, Then reminders come every 10 minutes. Given quiet, notices off or paused, Then no reminder is sent. | UC |
| FR-NOTIFY-02-10 | Given a chat ignored in Inbox, When Deputy restarts and messages arrive in it, Then the next notice still leaves it out (Notify keeps nothing; Inbox does). | UC, E2E |
| FR-NOTIFY-02-10 | Given the Inbox ignore list changes between two notices, When the second is prepared, Then it uses the changed list. Given `WaitingCounts` throws, Then the batch notice leaves no chat out, omits `otherWaiting` and carries the caveats `may_include_ignored` and `waiting_may_be_incomplete`; a due reminder is skipped and retried at the next tick. | UC |

Adapter contract: `NotifySettingsRepository` (in-memory and SQLite, same suite: defaults, round trip, quiet JSON, a failed save changes nothing) and `LocalCalendar` (`IntlLocalCalendar` against fixed instants for America/New_York, Asia/Kolkata with a half hour offset, and an invalid zone).

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| The system zone at first start is not the owner's (a server, a container in UTC) | Quiet hours land at the wrong time | `time_zone` is shown by `get_settings`; Setup can ask the owner to confirm it (open question). |
| An owner travels | Quiet hours follow the stored zone, not the traveler's | The owner changes `time_zone` by talking; FR-NOTIFY-02-2 says quiet periods move with the clock. |
| A zone database update changes DST rules while Deputy runs | A quiet period shifts by an hour for one day | Zone data comes from the runtime; the next release updates it. Accepted. |

## Open questions

1. Resolved by the lead: Setup shows the detected time zone together with the country and the owner confirms it. This TP only stores the system zone at first start.
2. Limited-time ignore (FRD-02 open question 3) stays out. It is an Inbox concern.
3. Whether the batching range depends on the provider (FRD-02 open question 2): this TP says no, one range for every provider.
