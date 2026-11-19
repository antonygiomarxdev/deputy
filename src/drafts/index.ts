import type { Clock } from "../shared/clock";
import type { Instant } from "../shared/instant";
import type { OwnerLease } from "../shared/owner-lease";
import { ApproveDraftUseCase } from "./application/approve-draft";
import { ApproveOrderCommandUseCase } from "./application/approve-order-command";
import { ChangeDraftUseCase } from "./application/change-draft";
import { CheckApprovalsUseCase } from "./application/check-approvals";
import { PendingOutcomes } from "./application/pending-outcomes";
import { RetryPendingOutcomesUseCase } from "./application/retry-pending-outcomes";
import { OnOrderDeletedUseCase } from "./application/on-order-deleted";
import { ReadDraftLogUseCase } from "./application/read-draft-log";
import { CreateDraftUseCase } from "./application/create-draft";
import { ListDraftsUseCase } from "./application/list-drafts";
import { RejectDraftUseCase } from "./application/reject-draft";
import { WaitingChatsUseCase } from "./application/waiting-chats";
import type {
  ApproveDraft,
  ApproveOrderCommand,
  ApproveResult,
  ChangeDraft,
  ChangeDraftResult,
  CheckApprovals,
  CreateDraft,
  CreateDraftResult,
  DraftView,
  ListDrafts,
  LogEntryView,
  MessageView,
  OnOrderDeleted,
  Outcome,
  ReadDraftLog,
  RejectDraft,
  RetryPendingOutcomes,
  WaitingChat,
  WaitingChats,
} from "./ports/inbound";
import type { ChatReader, CustomerTextCheck, Ids, OrderChanger, OrderInput, OrderPreparer, OrderRecorder, TextDigest, UnitOfWork } from "./ports/outbound";
import type { Sender } from "./ports/sender";

export type {
  ApproveDraft,
  ApproveOrderCommand,
  ApproveResult,
  ChangeDraft,
  ChangeDraftResult,
  CheckApprovals,
  CreateDraft,
  CreateDraftResult,
  DraftView,
  ListDrafts,
  LogEntryView,
  MessageView,
  Outcome,
  OnOrderDeleted,
  OrderInput,
  ReadDraftLog,
  RejectDraft,
  RetryPendingOutcomes,
  WaitingChat,
  WaitingChats,
};
export type { DraftEvent } from "./domain/events";
export type { Refusal } from "./domain/refusals";
export { refusalText } from "./domain/refusals";
export { refusalResult } from "./adapters/mcp/results";

export interface DraftsDeps {
  clock: Clock;
  lease: OwnerLease;
  sessionStartedAt: Instant;
  unitOfWork: UnitOfWork;
  chats: ChatReader;
  orders: OrderPreparer;
}

/** SPEC-02, SPEC-03 and SPEC-04 add dependencies and members. */
export function createDrafts(deps: DraftsDeps): {
  createDraft: CreateDraft;
  listDrafts: ListDrafts;
  changeDraft: ChangeDraft;
  rejectDraft: RejectDraft;
  waitingChats: WaitingChats;
  readDraftLog: ReadDraftLog;
  checkApprovals: CheckApprovals;
  onOrderDeleted: OnOrderDeleted;
} {
  const { clock, lease, unitOfWork, chats, orders, sessionStartedAt } = deps;
  return {
    createDraft: new CreateDraftUseCase({ clock, lease, unitOfWork, chats, orders }),
    listDrafts: new ListDraftsUseCase({ lease, unitOfWork, chats, orders, sessionStartedAt }),
    changeDraft: new ChangeDraftUseCase({ clock, lease, unitOfWork, orders }),
    rejectDraft: new RejectDraftUseCase({ clock, lease, unitOfWork }),
    waitingChats: new WaitingChatsUseCase({ unitOfWork, sessionStartedAt }),
    readDraftLog: new ReadDraftLogUseCase({ unitOfWork }),
    checkApprovals: new CheckApprovalsUseCase({ unitOfWork }),
    onOrderDeleted: new OnOrderDeletedUseCase({ clock, lease, unitOfWork }),
  };
}

export interface ApprovalDeps {
  clock: Clock;
  lease: OwnerLease;
  unitOfWork: UnitOfWork;
  customerText: CustomerTextCheck;
  sender: Sender;
  orderRecorder: OrderRecorder;
  orderChanger: OrderChanger;
  digest: TextDigest;
  ids: Ids;
}

/**
 * The owner's go: the one path that sends (approve_draft) and the order commands. Built apart from createDrafts so that
 * main.ts offers these tools only once a real sender exists: a tool that can never send must not be offered.
 */
export function createApprovals(deps: ApprovalDeps): {
  approveDraft: ApproveDraft;
  approveOrderCommand: ApproveOrderCommand;
  retryPendingOutcomes: RetryPendingOutcomes;
} {
  const { clock, lease, unitOfWork, customerText, sender, orderRecorder, orderChanger, digest, ids } = deps;
  const pending = new PendingOutcomes();
  return {
    approveDraft: new ApproveDraftUseCase({ clock, lease, unitOfWork, customerText, sender, recorder: orderRecorder, pending, digest, ids }),
    retryPendingOutcomes: new RetryPendingOutcomesUseCase({ clock, unitOfWork, pending }),
    approveOrderCommand: new ApproveOrderCommandUseCase({ clock, lease, unitOfWork, customerText, changer: orderChanger }),
  };
}
