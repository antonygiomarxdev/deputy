import { FakeChatReader } from "../../../src/drafts/adapters/memory/fake-chat-reader";
import { FakeOrderPreparer } from "../../../src/drafts/adapters/memory/fake-order-preparer";
import { InMemoryDrafts } from "../../../src/drafts/adapters/memory/in-memory-drafts";
import { FakeCustomerTextCheck } from "../../../src/drafts/adapters/memory/fake-customer-text-check";
import { FakeOrderChanger } from "../../../src/drafts/adapters/memory/fake-order-changer";
import { FakeOrderRecorder } from "../../../src/drafts/adapters/memory/fake-order-recorder";
import { FakeSender } from "../../../src/drafts/adapters/memory/fake-sender";
import { ApproveDraftUseCase } from "../../../src/drafts/application/approve-draft";
import { ApproveOrderCommandUseCase } from "../../../src/drafts/application/approve-order-command";
import { ChangeDraftUseCase } from "../../../src/drafts/application/change-draft";
import { RejectDraftUseCase } from "../../../src/drafts/application/reject-draft";
import { CreateDraftUseCase } from "../../../src/drafts/application/create-draft";
import { ListDraftsUseCase } from "../../../src/drafts/application/list-drafts";
import { WaitingChatsUseCase } from "../../../src/drafts/application/waiting-chats";
import type { ChatMessage, UnitOfWork } from "../../../src/drafts/ports/outbound";
import type { Clock } from "../../../src/shared/clock";
import type { OwnerLease } from "../../../src/shared/owner-lease";
import { FakeClock } from "../../support/fake-clock";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";

export function message(
  id: string,
  source: ChatMessage["source"],
  text: string,
  sentAt: number,
  over: Partial<ChatMessage> = {},
): ChatMessage {
  return { id: { provider: "dev", providerMessageId: id }, sentAt, storedAt: sentAt + 1, source, text, dev: false, history: false, ...over };
}

/** The Drafts use cases over in-memory adapters, a fake clock and a lease this process owns. */
export function makeDrafts(
  o: {
    chats?: Record<string, readonly ChatMessage[]>;
    activeWorldIsDev?: boolean;
    clock?: Clock;
    sessionStartedAt?: number;
    customerTexts?: string[];
    orderChats?: Record<string, string>;
    unitOfWork?: (store: InMemoryDrafts, lease: OwnerLease) => UnitOfWork;
  } = {},
) {
  const holder: LeaseHolder = { token: "me", heartbeat: 1 };
  const clock = o.clock ?? new FakeClock(1_000);
  const lease = new InMemoryOwnerLease(holder, clock, "me");
  const store = new InMemoryDrafts(lease);
  const chats = new FakeChatReader(o.chats ?? {}, { activeWorldIsDev: o.activeWorldIsDev });
  const orders = new FakeOrderPreparer();
  const unitOfWork = o.unitOfWork?.(store, lease) ?? store.unitOfWork;
  const createDraft = new CreateDraftUseCase({ clock, lease, unitOfWork, chats, orders });
  const sessionStartedAt = o.sessionStartedAt ?? 0;
  const listDrafts = new ListDraftsUseCase({ lease, unitOfWork, chats, orders, sessionStartedAt });
  const waitingChats = new WaitingChatsUseCase({ unitOfWork, sessionStartedAt });
  const sender = new FakeSender();
  const customerText = new FakeCustomerTextCheck(o.customerTexts ?? []);
  let issued = 0;
  const ids = { next: () => `ap${++issued}` };
  const digest = { sha256: (text: string) => `hash(${text})` };
  const recorder = new FakeOrderRecorder();
  const changer = new FakeOrderChanger(o.orderChats ?? {});
  const approveDraft = new ApproveDraftUseCase({ clock, lease, unitOfWork, customerText, sender, recorder, digest, ids });
  const changeDraft = new ChangeDraftUseCase({ clock, lease, unitOfWork, orders });
  const rejectDraft = new RejectDraftUseCase({ clock, lease, unitOfWork });
  const approveOrderCommand = new ApproveOrderCommandUseCase({ clock, lease, unitOfWork, customerText, changer });
  return { holder, clock, store, chats, orders, createDraft, listDrafts, waitingChats, sender, customerText, recorder, changer, approveDraft, approveOrderCommand, changeDraft, rejectDraft };
}
