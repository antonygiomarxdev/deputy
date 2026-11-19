import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { Approval } from "../domain/approval";
import type { Draft, DraftKind, DraftNumber } from "../domain/draft";
import type { DraftLogRepository } from "./log";

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
