import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { MessageId } from "../../shared/message-id";
import type { Approval } from "../domain/approval";
import type { Draft, DraftKind, DraftNumber } from "../domain/draft";
import type { DraftLogRepository } from "./log";

export type OrderInput = Readonly<Record<string, unknown>>; // validated by Orders' PrepareOrder

/** Every method runs inside UnitOfWork.run. */
export interface DraftRepository {
  nextNumber(): Promise<DraftNumber>;
  get(number: DraftNumber): Promise<Draft | null>;
  openFor(chat: ChatId, kind: DraftKind): Promise<Draft | null>;
  listOpen(filter?: { chat?: ChatId }): Promise<Draft[]>;
  /**
   * Insert when the number is new. Otherwise compare-and-set on draft.snapshot().revision and store revision + 1.
   * The object passed is not changed. Throws StaleDraft when the stored revision differs.
   */
  save(draft: Draft): Promise<void>;
  /** The normalized text equals the proposed or the current normalized text of any draft, in any state. */
  hasDraftText(normalized: string): Promise<boolean>;
  /**
   * An order was deleted in Orders: the texts of that order draft read "deleted" and its payload is cleared. The row and the
   * number stay. Does nothing for a reply draft. Counts as a write (the revision rises).
   */
  scrubOrderDraft(number: DraftNumber): Promise<void>;
}

export interface ApprovalRepository {
  /** An approval is born used (usedAt is set). Throws on a repeated id or sendId. */
  insert(approval: Approval): Promise<void>;
  /** Voids every live (not yet voided) approval of the draft; the rows stay. */
  void(draft: DraftNumber, reason: string, at: Instant): Promise<void>;
  forDraft(draft: DraftNumber): Promise<Approval[]>;
  /** The text, the owner's words and the hash of that order draft's approvals read "deleted"; the rows stay. Does nothing for a reply draft. */
  scrubOrderDraft(draft: DraftNumber): Promise<void>;
}

export interface Transaction {
  readonly drafts: DraftRepository;
  readonly approvals: ApprovalRepository;
  readonly log: DraftLogRepository;
}

/** What a pure read may use: no write method, and no transaction (so no write lock). */
export interface ReadTransaction {
  readonly drafts: Pick<DraftRepository, "get" | "openFor" | "listOpen" | "hasDraftText">;
  readonly log: Pick<DraftLogRepository, "page" | "sentWithApproval" | "stuckDrafts">;
}

export interface UnitOfWork {
  /** A read that takes no write lock and needs no lease. */
  read<T>(work: (tx: ReadTransaction) => Promise<T>): Promise<T>;
  run<T>(
    work: (tx: Transaction) => Promise<T>,
    options?: { requireLease?: boolean }, // default true: a write checks the lease; pure reads pass false
  ): Promise<T>; // commits when work resolves; rolls back and rethrows when it throws; transactions run one at a time
}

export type ChatMessage = {
  readonly id: MessageId;
  readonly sentAt: Instant;
  readonly storedAt: Instant;
  readonly source: "customer" | "owner_app" | "sent_through_deputy";
  readonly text: string; // Intake's readerText
  readonly dev: boolean;
  readonly history: boolean;
};

export type ChatInfo = {
  readonly hasCustomerMessage: boolean;
  readonly hasNonDevMessage: boolean;
  readonly activeWorldIsDev: boolean;
  readonly latestCustomer: ChatMessage | null;
  readonly latest: ChatMessage | null;
};

export interface ChatReader {
  describe(chat: ChatId): Promise<ChatInfo | null>; // null when the chat is unknown
  message(chat: ChatId, id: MessageId): Promise<ChatMessage | null>;
}

/** Drafts owns this port; the adapter calls Orders' PrepareOrder and revalidate. */
export interface OrderPreparer {
  prepare(
    chat: ChatId,
    order: OrderInput,
  ): Promise<{ ok: true; payload: string; summary: string } | { ok: false; reasons: string[] }>;
  revalidate(payload: string): Promise<{ catalogChanged: boolean }>;
}

/** Intake's IsCustomerText: does the text equal a stored customer message, in any chat? */
export interface CustomerTextCheck {
  isCustomerText(words: string): Promise<boolean>;
}

export interface TextDigest {
  sha256(text: string): string;
}

export interface Ids {
  next(): string;
}

/** Drafts owns this port; the adapter calls Orders' RecordOrder. Idempotent on draftNumber. */
export interface OrderRecorder {
  record(input: { draftNumber: number; payload: string; ownerWords: string }): Promise<
    | { ok: true; orderId: string }
    | { ok: false; kind: "outcome_unknown" }
    | { ok: false; kind: "refused"; reason: string }
  >;
}

/** The fields Orders accepts in a change (Orders ADR-008). Keys outside this list are refused, so a key can never carry customer text into the log. */
export const ORDER_FIELDS = ["status", "customer_name", "fulfillment", "address", "wanted_date", "wanted_time", "notes", "items"] as const;
export type OrderField = (typeof ORDER_FIELDS)[number];
export type OrderChangeInput = Readonly<Partial<Record<OrderField, unknown>>>;

/** Drafts owns this port; the adapter calls Orders' ChangeOrder and DeleteOrder. */
export interface OrderChanger {
  /**
   * The chat id of the order, and nothing else (no name, no address, no customer text): it goes into the log entry,
   * which is written before the command is called. null when the order is unknown.
   */
  chatOf(orderRef: string): Promise<string | null>;
  change(orderRef: string, change: OrderChangeInput, ownerWords: string): Promise<{ ok: true; detail: string } | { ok: false; reason: string }>;
  delete(
    orderRef: string,
    ownerWords: string,
    confirm: boolean,
  ): Promise<{ ok: true; detail: string } | { ok: false; reason: string } | { pending: string }>;
}
