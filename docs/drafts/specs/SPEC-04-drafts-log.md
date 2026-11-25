# Spec: The drafts log (Drafts FRD-04)

Status: Approved (2026-11-18)
Rests on: ../tp/TP-04-drafts-log.md

One per FRD, resting on [TP-04](../tp/TP-04-drafts-log.md). It decides nothing new. Task 1 is built early (after SPEC-01 Task 1) and Task 2 right after SPEC-01 Task 2, because every other Drafts use case appends log entries; Tasks 3 to 7 come after SPEC-03.

## Context

- FRD: [FRD-04](../frd/FRD-04-drafts-log.md). TP: [TP-04](../tp/TP-04-drafts-log.md). ADRs: ADR-008 (log links and check), ADR-009 (log paging by entry id), ADR-010 (scrub trigger guard), ADR-005 (order commands through Drafts), cross-slice ADR-003 (SQLite storage) and ADR-011 (ATDD).
- Build order inside Drafts: SPEC-01 Task 1, this spec's Task 1, SPEC-01 Task 2, this spec's Task 2, the rest of SPEC-01, SPEC-02, SPEC-03, then Tasks 3 to 7 here.
- From the foundation, not redefined (file names in SPEC-01 of this slice, Context): `Clock`, `OwnerLease` (`isOwner(within?)` returns a promise), `SqlDatabase` and `SqlExecutor`, `ChatId`, `Instant`, `defineTool`, `customerText(label, text)`, `test/support/harness.ts`, `FakeClock`, `InMemoryOwnerLease`, `LeaseSupervisor`, `test/architecture/imports.ts` (`listImports`).
- Orders has no spec. Drafts receives Orders' `OrderDeleted {eventId, orderId, draftNumber, chat}` through `OnOrderDeleted`; the Orders outbox adapter that calls it is out of scope. `draftNumber` is null when the order is not from this data folder, so Drafts scrubs nothing it did not make.
- Knowledge reads the log through `ReadDraftLog` with `after`, called by the MCP adapter of the lesson tools (Knowledge's spec). Drafts never pushes to Knowledge.
- Times are `Instant` in the domain and ISO-8601 UTC text in SQLite.

Choices this spec makes where TP-04 is silent (L9): `approvalEntryIdFor` and `hasOrderDeleted` are in `DraftLogRepository`; `RetryPendingOutcomes` is the 10-second retry; a `limit` outside 1 to 100 is `bad_limit`; `stuckDrafts` lists reply drafts only; a failed outcome write other than `sent` returns `log_unavailable`.

## Files

| Path | Change | Holds |
|---|---|---|
| `src/drafts/domain/log-entry.ts` | create | `LogKind`, `NewLogEntry`, `LogEntry` |
| `src/drafts/domain/log-mapper.ts` | create | `toLogEntries` (an exhaustive switch over `DraftEvent`) |
| `src/drafts/domain/approval-audit.ts` | create | `ApprovalAudit` |
| `src/drafts/ports/log.ts` | create | `DraftLogRepository` |
| `src/drafts/ports/inbound.ts` | change | `ReadDraftLog`, `CheckApprovals`, `OnOrderDeleted`, `RetryPendingOutcomes` and their results |
| `src/drafts/ports/outbound.ts` | change | `DraftRepository.scrubOrderDraft`, `ApprovalRepository.scrubOrderDraft` |
| `src/drafts/application/read-draft-log.ts` | create | `ReadDraftLog` |
| `src/drafts/application/check-approvals.ts` | create | `CheckApprovals` |
| `src/drafts/application/on-order-deleted.ts` | create | `OnOrderDeleted` |
| `src/drafts/application/retry-pending-outcomes.ts` | create | `RetryPendingOutcomes` |
| `src/drafts/application/pending-outcomes.ts` | create | the `PendingOutcomes` class: `add(item)`, `list()`, `remove(sendId)`; no module state. `createDrafts` makes one instance and passes it to `ApproveDraft` and `RetryPendingOutcomes` |
| `src/drafts/application/approve-draft.ts` | change | the retried write of the `sent` entry |
| `src/drafts/adapters/memory/in-memory-drafts.ts` | change | in-memory `DraftLogRepository` with the same rules as the triggers |
| `src/drafts/adapters/sqlite/sqlite-draft-log-repository.ts` | create | `SqliteDraftLogRepository` |
| `src/drafts/adapters/sqlite/sqlite-draft-repository.ts`, `sqlite-approval-repository.ts` | change | `scrubOrderDraft` |
| `src/drafts/adapters/sqlite/sqlite-unit-of-work.ts` | change | `log` in the transaction object |
| `src/drafts/adapters/sqlite/migrations/0002-log.sql` | create | `drafts_log`, its indexes and triggers |
| `src/drafts/index.ts` | change | `readDraftLog`, `checkApprovals`, `onOrderDeleted`, `retryPendingOutcomes` |
| `src/drafts/adapters/mcp/drafts-tools.ts` | change | tools `drafts_log`, `check_approvals` |
| `src/composition/mcp/instructions.ts` | change | "the log is a record: nothing changes or deletes an entry" |
| `src/main.ts` | change | add `0002-log.sql` to the migration list right after `0001-drafts.sql` (SPEC-02 adds `0003-approvals.sql` after it); pass `retryPendingOutcomes.run` as the supervisor's `onTick` |
| `test/drafts/unit/log-mapper.test.ts`, `approval-audit.test.ts` | create | domain tests |
| `test/drafts/contract/draft-log-repository.contract.ts`, `.memory.test.ts`, `.sqlite.test.ts` | create | repository contract |
| `test/drafts/contract/log-triggers.sqlite.test.ts` | create | the triggers and the schema CHECKs, SQLite only |
| `test/drafts/acceptance/log-entries.test.ts` | create | entries written by the use cases |
| `test/drafts/acceptance/read-and-check.test.ts` | create | `ReadDraftLog` and `CheckApprovals` |
| `test/drafts/acceptance/order-scrub.test.ts` | create | `OnOrderDeleted` |
| `test/drafts/acceptance/sent-log-gap.test.ts` | create | the failed `sent` write |
| `test/drafts/acceptance/drafts-log.e2e.test.ts` | create | tools over stdio |
| `test/drafts/acceptance/log-crash.test.ts` | create | crash tests |
| `test/architecture/drafts-rules.test.ts` | change | no use case imports Knowledge |

## Interfaces

`src/drafts/domain/log-entry.ts`:

```ts
import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { DraftKind, DraftNumber } from "./draft";

export type LogKind =
  | "proposed" | "replaced" | "text_changed" | "approved" | "approval_voided" | "rejected" | "held"
  | "owner_choice" | "sending" | "sent" | "failed" | "unknown" | "recorded" | "order_command" | "order_deleted";

export interface NewLogEntry {
  readonly at: Instant;
  readonly kind: LogKind;
  readonly draft: DraftNumber | null;
  readonly draftKind: DraftKind | null;
  readonly chat: ChatId;
  readonly proposedText: string | null;   // null for order drafts (the schema enforces it)
  readonly finalText: string | null;      // null for order drafts
  readonly reason: string | null;
  readonly ownerWords: string | null;
  readonly approvalEntryId: number | null; // id of the `approved` entry of the attempt
  readonly sendId: string | null;
  readonly orderRef: string | null;        // an order id, never a name or an address
}
export interface LogEntry extends NewLogEntry { readonly id: number; readonly scrubbed: boolean; }
```

`src/drafts/domain/log-mapper.ts`:

```ts
import type { DraftEvent } from "./events";
export type LogContext = { readonly approvalEntryId: number | null };
/** One entry per event, in order. The switch is exhaustive: a new DraftEvent member fails the typecheck until its case exists.
 *  For an order draft (draftKind "order") proposedText and finalText are null. */
export function toLogEntries(events: readonly DraftEvent[], ctx: LogContext): NewLogEntry[];
```

What each event writes (TP-04 "Which fields each kind fills"):

| Event | Kind | Fields besides `at`, `draft`, `draftKind`, `chat` |
|---|---|---|
| `DraftProposed` | `proposed` | proposed and final text equal to the text |
| `DraftReplaced` | `replaced` | reason `replaced by N` |
| `TextChanged` | `text_changed` | proposed text (the draft's original), final text (the new), owner words |
| `Approved` | `approved` | proposed text, final text (the text approved), owner words, send id |
| `ApprovalVoided` | `approval_voided` | reason (changed, replaced, rejected, held), pointer `ctx.approvalEntryId` |
| `DraftRejected` | `rejected` | owner words |
| `DraftHeld` | `held` | reason codes joined by ",", pointer |
| `OwnerChose` | `owner_choice` | reason `send_as_is`, `edit` or `drop`, owner words |
| `SendStarted` | `sending` | pointer, send id, final text |
| `SendQueued` | `sending` | pointer, send id of the attempt, reason `send_queued` |
| `DraftSent` | `sent` | pointer, send id, final text (equal to the approved text), reason when given (`found_after_unknown`) |
| `SendFailed` | `failed` | pointer, reason code |
| `OutcomeUnknown` | `unknown` | pointer, reason code |
| `OrderRecorded` | `recorded` | pointer, `orderRef` equal to the order id |

Entries that are not draft events are built by their use case: `order_command` (owner words, `orderRef`, reason from field names) and `failed` for a refused order command (SPEC-02), and `order_deleted` (`orderRef`).

`src/drafts/ports/log.ts`:

```ts
export interface DraftLogRepository { // takes part in the UnitOfWork
  append(entries: NewLogEntry[]): Promise<number[]>; // ids in order; throws LogUnavailable; fails the whole transaction
  page(filter: { chat?: ChatId; before?: number; after?: number; limit: number }): Promise<LogEntry[]>;
  sentWithApproval(): Promise<{ sent: LogEntry; approval: LogEntry | null }[]>; // approval = the entry that sent.approvalEntryId points to
  stuckDrafts(): Promise<{ draft: number; chat: string; state: "sending" | "unknown"; since: string }[]>;
  scrubOrder(orderId: string, draftNumber: number | null): Promise<number>; // the one update path
  approvalEntryIdFor(sendId: string): Promise<number | null>; // the `approved` entry with that send id
  hasOrderDeleted(orderRef: string): Promise<boolean>;         // an `order_deleted` entry exists
}
```


`src/drafts/domain/approval-audit.ts`:

```ts
export type AuditDefect = {
  entryId: number; draft: number; chat: string;
  problem: "no_approval" | "wrong_approval" | "approval_after_sent" | "text_differs" | "approval_shared";
};
export type AuditGap = { draft: number; chat: string; state: "sending" | "unknown"; since: string };
export const ApprovalAudit = {
  /** no_approval: no pointer or no such entry. wrong_approval: the entry is not `approved` or belongs to another draft.
   *  approval_after_sent: the approval's id is not lower than the sent entry's id. text_differs: finalText differs.
   *  approval_shared: two sent entries point to one approval. */
  audit(rows: { sent: LogEntry; approval: LogEntry | null }[], stuck: AuditGap[]): { defects: AuditDefect[]; gaps: AuditGap[] };
};
```

Inbound ports (`src/drafts/ports/inbound.ts`):

```ts
export type LogEntryView = {
  id: number; at: string; kind: LogKind; draft: number | null; chat: string;
  proposedText: string | null; finalText: string | null; reason: string | null; ownerWords: string | null;
  scrubbed: boolean;
  /** The customer message the draft answered. Set only on `approved` and `rejected` entries of a reply draft; read from drafts.answers_message_id; an id, not text. */
  answersMessageId: string | null;
};
export interface ReadDraftLog {
  /** limit 1 to 100, default 20 (about 3k to 6k tokens; the maximum is about 15k to 30k, ADR-009).
   *  Without `after`: newest first, entries with id < before. With `after`: oldest first, entries with id > after. A pure read, no lease check. */
  run(input: { chat?: string; limit?: number; before?: number; after?: number }):
    Promise<Outcome<{ entries: LogEntryView[]; nextBefore: number | null }>>;
}
export interface CheckApprovals {
  run(): Promise<{ defects: AuditDefect[]; gaps: AuditGap[] }>;   // a pure read
}
export interface OnOrderDeleted {
  run(event: { eventId: string; orderId: string; draftNumber: number | null; chat: string }): Promise<{ scrubbed: number } | { refused: "not_owner" }>;
}
export interface RetryPendingOutcomes { run(): Promise<{ written: number; pending: number }>; }
```

New refusal code `{ code: "bad_limit" }`, text "limit must be between 1 and 100". `nextBefore` is the id of the oldest returned entry when older entries exist, else null.

Outbound additions: `DraftRepository.scrubOrderDraft(number: DraftNumber): Promise<void>` sets `current_text`, `proposed_text`, `current_norm` and `proposed_norm` to "deleted" and clears `order_payload`, keeping the row and the number. `ApprovalRepository.scrubOrderDraft(number: DraftNumber): Promise<void>` sets `text`, `owner_words` and `text_hash` of that draft's approvals to "deleted".

Flows.
- `ReadDraftLog`: `page`, then for each distinct draft number of an `approved` or `rejected` entry of a reply draft, `drafts.get` supplies `answersMessageId`. A `limit` outside 1 to 100 is `bad_limit`.
- `CheckApprovals`: `sentWithApproval` and `stuckDrafts`, then `ApprovalAudit.audit`. `stuckDrafts` lists reply drafts in "sending" or "unknown" that have no `sent` entry; `since` is the time of the draft's latest `sending` entry.
- `OnOrderDeleted`: a lease check first; when this process is not the owner it returns `{ refused: "not_owner" }` and changes nothing, so the Orders outbox redelivers the event to the owner. Then, in one Drafts-only transaction (`requireLease: true`; a `LeaseLost` gives the same refusal): if `hasOrderDeleted(orderId)` the use case returns `{ scrubbed: 0 }`; else `log.scrubOrder(orderId, draftNumber)`, and when `draftNumber` is not null `drafts.scrubOrderDraft` and `approvals.scrubOrderDraft`, then one `order_deleted` entry with `orderRef`. A second run with the same order does nothing.
- The failed `sent` write. In `driveSend` the transaction that finishes a send as `sent` is tried three times: now, after `Clock.sleep(1000)`, and after `Clock.sleep(2000)` more (1 and 3 seconds from the first try). If all three fail, the use case returns `{ outcome: "sent", logged: false }` (the owner is told the message went out and the record is missing), never sends again, and adds `{ draft, sendId, text }` to `PendingOutcomes`. The draft stays "sending", so `CheckApprovals` lists it as a gap. `RetryPendingOutcomes.run` is the supervisor's `onTick` (Intake SPEC-04: called after each lease renewal, every 10 seconds, only while this process is the owner) and repeats the transaction for each pending item; on success it writes `finishSent` and the `sent` entry and removes the item. If the process ends, `RecoverInterrupted` makes the draft "unknown" and `ResolveUnknownSends` links the message and writes `sent` (SPEC-03). For results other than `sent`, a transaction 4 that throws returns `log_unavailable` and leaves the draft "sending" or "recording", which the next start recovers.
- Any use case whose unit of work throws `LogUnavailable` returns `log_unavailable` and has done nothing.

MCP tools (`src/drafts/adapters/mcp/drafts-tools.ts`):
- `drafts_log`: `{ chat: z.string().min(1).optional(), limit: z.number().int().min(1).max(100).default(20), before: z.number().int().min(1).optional() }`. Output: entries newest first with id, time, kind, draft, the proposed and final text and the owner's words, each text and words field inside one `<customer_text>` block through the shared helper; "nothing yet" when empty and no chat given; "no entries for this chat" when empty with a chat; the `before` value of the oldest shown entry when older ones exist. The tool does not expose `after`.
- `check_approvals`: no input. Output: the defects with entry id and problem, the gaps ("sending" or "unknown" with no `sent` entry and since when), or "every sent message has an approval".
- No tool changes or deletes an entry. The `instructions` string says the log is a record and a request to delete an entry is refused.

## Data

`src/drafts/adapters/sqlite/migrations/0002-log.sql` (TP-04 Information). It follows `0001-drafts.sql` in the global list because of the foreign key to `drafts`; it needs nothing from `0003-approvals.sql`.

```sql
CREATE TABLE drafts_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  at                TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN
    ('proposed','replaced','text_changed','approved','approval_voided','rejected','held',
     'owner_choice','sending','sent','failed','unknown','recorded','order_command','order_deleted')),
  draft_number      INTEGER REFERENCES drafts(number),
  draft_kind        TEXT CHECK (draft_kind IN ('reply','order')),
  chat              TEXT NOT NULL,
  proposed_text     TEXT,
  final_text        TEXT,
  reason            TEXT,
  owner_words       TEXT,
  approval_entry_id INTEGER REFERENCES drafts_log(id),
  send_id           TEXT,
  order_ref         TEXT,
  scrubbed          INTEGER NOT NULL DEFAULT 0,
  CHECK (draft_number IS NOT NULL OR order_ref IS NOT NULL),
  CHECK (draft_kind IS NOT 'order' OR (proposed_text IS NULL AND final_text IS NULL))
);
CREATE INDEX drafts_log_by_chat  ON drafts_log (chat, id);
CREATE INDEX drafts_log_by_draft ON drafts_log (draft_number, id);
CREATE INDEX drafts_log_by_order ON drafts_log (order_ref);

CREATE TRIGGER drafts_log_no_delete BEFORE DELETE ON drafts_log
BEGIN SELECT RAISE(ABORT, 'drafts_log is append-only'); END;

CREATE TRIGGER drafts_log_scrub_only BEFORE UPDATE ON drafts_log
WHEN NOT (
      OLD.scrubbed = 0 AND NEW.scrubbed = 1
  AND (NEW.owner_words IS OLD.owner_words OR NEW.owner_words = 'deleted')
  AND (OLD.draft_kind = 'order' OR OLD.kind IN ('order_command','order_deleted'))
  AND NEW.id IS OLD.id AND NEW.at IS OLD.at AND NEW.kind IS OLD.kind
  AND NEW.draft_number IS OLD.draft_number AND NEW.draft_kind IS OLD.draft_kind
  AND NEW.chat IS OLD.chat AND NEW.proposed_text IS OLD.proposed_text
  AND NEW.final_text IS OLD.final_text AND NEW.reason IS OLD.reason
  AND NEW.approval_entry_id IS OLD.approval_entry_id AND NEW.send_id IS OLD.send_id
  AND NEW.order_ref IS OLD.order_ref
)
BEGIN SELECT RAISE(ABORT, 'drafts_log is append-only'); END;
```

A migration that later rebuilds `drafts_log` drops and re-creates the two triggers in the same file (cross-cutting TP, TD-3). Page order uses `id` only, never the time. `page` with `before` is `WHERE id < :before ORDER BY id DESC LIMIT :limit`; with `after` it is `WHERE id > :after ORDER BY id ASC LIMIT :limit`.

## Tasks

### Task 1: The log core, in memory
- **Tests first:** `test/drafts/unit/log-mapper.test.ts` and `test/drafts/contract/draft-log-repository.contract.ts` (exports `draftLogRepositoryContract(name, make)`), run here by `draft-log-repository.memory.test.ts`.
  - FR-DRAFTS-04-1: Given the events `DraftProposed`, `DraftReplaced`, `TextChanged`, `DraftRejected` and `ApprovalVoided` of SPEC-01, Then `toLogEntries` returns one entry per event, in order, each naming the draft and the chat, with the fields of the table above.
  - FR-DRAFTS-04-2: Given `TextChanged` after `DraftProposed`, Then the `text_changed` entry holds the original proposed text and the new final text.
  - FR-DRAFTS-04-1: Given two entries appended in the same second (equal `at`), Then `page` returns them in id order, and ids rise by one per entry (C).
  - FR-DRAFTS-04-3: Given appended entries, Then each gets an id and `append` returns the ids in order. Given `page({ after })`, Then entries come oldest first with ids above `after`; with `before`, newest first with ids below it; `limit` bounds the page.
  - FR-DRAFTS-04-6: Given entries of two chats, Then `page({ chat })` returns only that chat's entries.
  - FR-DRAFTS-04-9: Given an entry with `draft_kind` "order" and a proposed or final text, or an entry with neither a draft number nor an order reference, Then the in-memory log refuses it, like the SQLite CHECKs of Task 2.
- **Build:** `domain/log-entry.ts`, `domain/log-mapper.ts` (the cases of SPEC-01's events; each later spec adds its cases), `ports/log.ts`, the in-memory log repository (append-only, with the same refusals as the triggers).
- **Done when:** `bun test test/drafts/unit/log-mapper.test.ts test/drafts/contract` and `bun run typecheck` pass.

### Task 2: The SQLite log, the migration and the units of work
Built after SPEC-01 Task 2, because `drafts_log` has a foreign key to `drafts` and the `log` member joins the units of work that task builds.
- **Tests first:** `test/drafts/contract/draft-log-repository.sqlite.test.ts` (the Task 1 contract on SQLite over the foundation's in-memory `SqlDatabase`, with `0001-drafts.sql` and `0002-log.sql` applied) and `test/drafts/contract/log-triggers.sqlite.test.ts`.
  - FR-DRAFTS-04-3: Given the Task 1 contract, Then the SQLite repository passes it unchanged.
  - FR-DRAFTS-04-7: Given the SQLite database, Then every UPDATE on `drafts_log` aborts except the scrub update of an order entry (`scrubbed` 0 to 1, words unchanged or "deleted", every other column equal), and every DELETE aborts. A schema test lists the table's columns and fails when a column is not covered by the trigger's list.
  - FR-DRAFTS-04-9: Given an entry with `draft_kind` "order" and a proposed or final text, Then the insert is refused by the CHECK. Given an entry with neither a draft number nor an order reference, Then it is refused.
  - FR-DRAFTS-04-7: Given a log that cannot be written (a fake that throws on `append`), Then both units of work roll back the draft change made in the same transaction.
- **Build:** `SqliteDraftLogRepository` (this task: `append`, `page`, `approvalEntryIdFor`), `0002-log.sql`, the `log` member of both units of work, and the `main.ts` registration of the migration.
- **Done when:** `bun test test/drafts/contract test/drafts/contract/log-triggers.sqlite.test.ts` and `bun run typecheck` pass.

### Task 3: Every event writes its entry
- **Tests first:** `test/drafts/acceptance/log-entries.test.ts`, layer UC (all use cases of SPEC-01 to SPEC-03 over the in-memory adapters).
  - FR-DRAFTS-04-1: Given a draft that is proposed, changed, approved and sent, Then the log holds `proposed`, `text_changed`, `approved`, `sending`, `sent`, one per event and in that order, each naming the draft and the chat.
  - FR-DRAFTS-04-1: Given the events of every other kind (replaced, rejected, approval voided, held, owner choice, queued, failed, unknown, recorded), Then each produces an entry that names the draft and the chat, and the test fails when a `DraftEvent` member has no case.
  - FR-DRAFTS-04-2: Given a draft the owner edited and sent, Then the log keeps the proposed text and the final text, and they differ.
  - FR-DRAFTS-04-4: Given an approval, Then the `approved` entry holds the owner's whole sentence and the send id; the `sending`, `sent`, `held`, `failed` and `unknown` entries of that attempt carry `approvalEntryId` equal to the `approved` entry's id; the `sent` entry's final text equals the approved text.
  - FR-DRAFTS-04-8: Given an order approved under the go rules, Then the log has `approved`, `sending` and `recorded` entries with the owner's words and the order id in `orderRef`, and no text. Given `ApproveOrderCommand`, Then an `order_command` entry holds the owner's words and the order reference.
  - FR-DRAFTS-04-9: Given an approved order, Then its entries hold a reference and the owner's words, and no name or address field exists on `LogEntry`.
  - FR-DRAFTS-04-9: Given a change of `status` and `date_wanted` whose values hold a customer name, Then the `order_command` reason is "changed: status, date_wanted" and no log field holds the name.
  - FR-DRAFTS-04-7: Given a log append that throws during `ApproveDraft`, Then the result is `log_unavailable`, `FakeSender` has no call, and the draft is unchanged.
- **Build:** the remaining cases of `toLogEntries` and the log writes of every use case, if any is missing.
- **Done when:** `bun test test/drafts/acceptance/log-entries.test.ts` and `bun run typecheck` pass.

### Task 4: Reading the log and checking approvals
- **Tests first:** `test/drafts/unit/approval-audit.test.ts` (D) and `test/drafts/acceptance/read-and-check.test.ts` (UC), plus the `sentWithApproval` and `stuckDrafts` cases of the repository contract.
  - FR-DRAFTS-04-3: Given entries, When `ReadDraftLog` runs with `after`, Then entries come oldest first with ids above it. Given `approved` and `rejected` entries of a reply draft, Then `answersMessageId` equals the draft's answered message; on `proposed`, `sent` and order entries it is null.
  - FR-DRAFTS-04-5: Given three sent messages each with an approval, When `CheckApprovals` runs, Then there are no defects and no gaps. Given a `sent` entry with no approval entry, Then the defect is `no_approval` with the entry id, draft and chat (UC and C).
  - FR-DRAFTS-04-4: Given a `sent` entry whose final text differs from the approved text, Then `text_differs`. Given a pointer to an entry that is not `approved` or belongs to another draft, Then `wrong_approval`. Given a pointer to an entry with a higher id, Then `approval_after_sent`. Given two `sent` entries pointing to one approval, Then `approval_shared`.
  - FR-DRAFTS-04-6: Given entries of two chats, When the log of one chat is read, Then only that chat's entries show, newest first. Given 25 entries and `limit` 20, Then `nextBefore` is the id of the oldest shown entry and `before` returns the next page; a new entry added meanwhile does not shift the pages.
  - FR-DRAFTS-04-6: Given an empty log, Then the entries are empty and `nextBefore` is null; given a chat with no entries, the same. A `limit` of 0 or 101 is `bad_limit`.
  - FR-DRAFTS-04-5: Given a draft in "sending" with no `sent` entry, Then `CheckApprovals` lists it as a gap with the time of its `sending` entry.
  - FR-DRAFTS-04-3: Given a call to `ReadDraftLog` with no lease, Then it still answers (a pure read).
- **Build:** `domain/approval-audit.ts`, `application/read-draft-log.ts`, `application/check-approvals.ts`, `sentWithApproval` and `stuckDrafts` in both repositories, and the wiring.
- **Done when:** `bun test test/drafts/unit test/drafts/acceptance/read-and-check.test.ts test/drafts/contract` and `bun run typecheck` pass.

### Task 5: The order scrub
- **Tests first:** `test/drafts/acceptance/order-scrub.test.ts`, layer UC and C (SQLite), and `log-crash.test.ts` (X).
  - FR-DRAFTS-04-10: Given an order draft that was approved, recorded and then deleted in Orders, When `OnOrderDeleted` runs, Then its log entries show `scrubbed` true and owner words "deleted", `drafts.current_text`, `proposed_text`, `current_norm` and `proposed_norm` read "deleted", `order_payload` is null, `approvals.text`, `owner_words` and `text_hash` read "deleted" (the test asserts each column), and the order reference, the approval entries' existence and the draft row stay.
  - FR-DRAFTS-04-10: Given `order_command` entries of that order, Then they are scrubbed too; entries of other orders and of reply drafts are untouched.
  - FR-DRAFTS-04-10: Given the event delivered twice (same `eventId`), Then the second run returns `scrubbed` 0, and exactly one `order_deleted` entry exists.
  - FR-DRAFTS-04-10: Given `draftNumber` null (an order of another folder), Then no draft or approval row changes.
  - FR-DRAFTS-04-7: Given every other update of a log entry (text, kind, reason) and any delete, Then the SQLite trigger aborts it.
  - FR-DRAFTS-04-10: Given the process killed between the order delete and the scrub (the event not handled), When the outbox event is delivered again at restart, Then the scrub completes once.
- **Build:** `application/on-order-deleted.ts`, `scrubOrder`, `hasOrderDeleted`, `scrubOrderDraft` in the SQLite and in-memory repositories, the wiring of `onOrderDeleted` in `createDrafts`.
- **Done when:** `bun test test/drafts/acceptance/order-scrub.test.ts` and `bun run typecheck` pass.

### Task 6: A `sent` entry that cannot be written
- **Tests first:** `test/drafts/acceptance/sent-log-gap.test.ts`, layer UC (a log repository that fails the `sent` append a scripted number of times, `FakeClock`) and the X case in `log-crash.test.ts`.
  - FR-DRAFTS-04-5: Given the provider accepted and the `sent` write fails three times (now, after 1 second, after 3 seconds on the `FakeClock`), Then the result is `sent` with `logged` false, the owner is told, `FakeSender` has one call, and `CheckApprovals` lists the draft as a gap ("sending" with no `sent` entry).
  - FR-DRAFTS-04-5: Given the pending item, When the `FakeClock` advances 10 seconds and `RetryPendingOutcomes` runs and the write now works, Then the `sent` entry exists, the draft is "sent", the gap is gone and `FakeSender` still has one call. While it still fails, `pending` is 1 and no second send happens.
  - FR-DRAFTS-04-5: Given the first write fails and the second works, Then `logged` is true after one retry.
  - FR-DRAFTS-04-5: Given the process killed with the `sent` write pending, When it restarts, Then the draft is "unknown" and `ResolveUnknownSends` links the message and writes `sent` (X).
- **Build:** the retried write in `application/approve-draft.ts`, `application/retry-pending-outcomes.ts`, `application/pending-outcomes.ts`, and in `src/main.ts` the `onTick` of `LeaseSupervisor` calling `retryPendingOutcomes.run()` (a throw goes to `console.error`, per Intake SPEC-04, so the tick never stalls renewals).
- **Done when:** `bun test test/drafts/acceptance/sent-log-gap.test.ts` and `bun run typecheck` pass.

### Task 7: The tools, the instructions and the end-to-end flow
- **Tests first:** `test/drafts/acceptance/drafts-log.e2e.test.ts` (layer E, the server over stdio with the dev provider) and the changed `test/architecture/drafts-rules.test.ts` (ARCH).
  - FR-DRAFTS-04-6: Given a draft that was created, listed, changed, approved and sent for chat A and another for chat B, When `drafts_log` is called with chat A, Then only A's entries show, newest first, and the example of FRD-04 reads in that order; a long log pages with `before`.
  - FR-DRAFTS-04-6: Given an empty log, Then the answer says "nothing yet"; given a chat with no entries, "no entries for this chat".
  - FR-DRAFTS-04-5: Given a sent message, When `check_approvals` is called, Then it answers "every sent message has an approval".
  - FR-DRAFTS-04-7: Given the tool list, Then no tool changes or deletes a log entry, and the `instructions` string says the log is a record.
  - FR-DRAFTS-04-9: Given a draft text and owner words that contain `</customer_text>` and `&`, Then `drafts_log` returns them escaped inside one label.
  - FR-DRAFTS-04-3: The architecture test fails when any file under `src/drafts/application/` imports Knowledge, so no use case of Drafts writes to Knowledge.
- **Build:** the tools, the `instructions` line, the wiring in `src/main.ts`.
- **Done when:** `bun test test/drafts test/architecture` and `bun run typecheck` pass.

## Out of scope

- The Orders outbox adapter that delivers `OrderDeleted` to `OnOrderDeleted`, and Orders' own deletion: Orders has no spec. An end-to-end test of `change_order` and `delete_order` waits for it; the use case tests of SPEC-02 and Task 2 here cover the rule.
- Erasing deleted text from the database file and its write-ahead log (`secure_delete`): the foundation's `SqlDatabase` adapter, tested there.
- Knowledge's reading of the log and the lesson tools: Knowledge's spec.
- Archiving or pruning old entries: the log is kept for the life of the database in v1 (TP-04 open questions).
