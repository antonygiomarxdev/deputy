import { FakeChatReader } from "../../../src/drafts/adapters/memory/fake-chat-reader";
import { FakeOrderPreparer } from "../../../src/drafts/adapters/memory/fake-order-preparer";
import { InMemoryDrafts } from "../../../src/drafts/adapters/memory/in-memory-drafts";
import { CreateDraftUseCase } from "../../../src/drafts/application/create-draft";
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
  return { holder, clock, store, chats, orders, createDraft };
}
