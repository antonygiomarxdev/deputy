import type { Clock } from "../shared/clock";
import type { Instant } from "../shared/instant";
import type { OwnerLease } from "../shared/owner-lease";
import { ChangeDraftUseCase } from "./application/change-draft";
import { CreateDraftUseCase } from "./application/create-draft";
import { ListDraftsUseCase } from "./application/list-drafts";
import { RejectDraftUseCase } from "./application/reject-draft";
import { WaitingChatsUseCase } from "./application/waiting-chats";
import type {
  ChangeDraft,
  ChangeDraftResult,
  CreateDraft,
  CreateDraftResult,
  DraftView,
  ListDrafts,
  MessageView,
  Outcome,
  RejectDraft,
  WaitingChat,
  WaitingChats,
} from "./ports/inbound";
import type { ChatReader, OrderInput, OrderPreparer, UnitOfWork } from "./ports/outbound";

export type {
  ChangeDraft,
  ChangeDraftResult,
  CreateDraft,
  CreateDraftResult,
  DraftView,
  ListDrafts,
  MessageView,
  Outcome,
  OrderInput,
  RejectDraft,
  WaitingChat,
  WaitingChats,
};
export type { DraftEvent } from "./domain/events";
export type { Refusal } from "./domain/refusals";
export { refusalText } from "./domain/refusals";

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
} {
  const { clock, lease, unitOfWork, chats, orders, sessionStartedAt } = deps;
  return {
    createDraft: new CreateDraftUseCase({ clock, lease, unitOfWork, chats, orders }),
    listDrafts: new ListDraftsUseCase({ lease, unitOfWork, chats, orders, sessionStartedAt }),
    changeDraft: new ChangeDraftUseCase({ clock, lease, unitOfWork, orders }),
    rejectDraft: new RejectDraftUseCase({ clock, lease, unitOfWork }),
    waitingChats: new WaitingChatsUseCase({ unitOfWork, sessionStartedAt }),
  };
}
