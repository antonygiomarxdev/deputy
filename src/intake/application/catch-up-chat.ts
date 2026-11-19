import { groupChatId, lineChatId, type ChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { PhoneNumber } from "../../shared/phone-number";
import { CALLER_WAIT_MS, CHAT_LOOKUP_WINDOW_MS, OVERLAP_MS, PAGE_SIZE } from "../domain/constants";
import { chatMarkOf, type ChatState } from "../domain/chat-state";
import type { CatchUpChat } from "../ports/catch-up-chat";
import type { EventPublisher } from "../ports/event-publisher";
import { LeaseLostError, type IntakeRepos, type IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import { ProviderError, type Cursor, type Provider, type ProviderConversation } from "../ports/provider";
import type { ChatStateView } from "../ports/views";
import { toChatStateView } from "./chat-state-view";
import { publishEach, storedEvents } from "./publish-each";
import { PageWalk, walkPages } from "./page-walk";
import { RunBudget, RunStopped, RunTotals } from "./run-state";
import type { RunCoordinator } from "./run-coordinator";
import type { StoreMessages } from "./store-messages";
import { storePage } from "./sweeps";

export interface CatchUpChatDeps {
  provider: Provider;
  clock: Clock;
  lease: OwnerLease;
  uow: IntakeUnitOfWork;
  /** Reads outside any transaction. */
  reads: IntakeRepos;
  store: StoreMessages;
  publisher: EventPublisher;
  /** Only waited on: this use case never starts a run. */
  coordinator: Pick<RunCoordinator, "waitIdle">;
}

type Result = Awaited<ReturnType<CatchUpChat["execute"]>>;
type Failed = Extract<Result, { kind: "failed" }>["reason"];

/** bad_response is shown as unreachable: the caller cannot act on the difference. */
function failureOf(e: unknown): Failed {
  if (e instanceof RunStopped) return "unreachable";
  if (e instanceof ProviderError) {
    switch (e.kind) {
      case "rate_limited":
        return "usage_limit";
      case "bad_response":
        return "unreachable";
      default:
        return e.kind;
    }
  }
  return "storage";
}

/** The newest stored time of the chat: the latest of the customer's, the answer's and the unattributed one. */
function latestOf(s: ChatState): number | null {
  const times = [s.lastCustomerAt, s.lastAnswerAt, s.lastUnattributedAt].filter((t): t is number => t !== null);
  return times.length === 0 ? null : Math.max(...times);
}

function chatOfConversation(c: ProviderConversation): ChatId | null {
  if (c.counterpart === null) return null;
  if (c.group) return groupChatId(c.counterpart);
  const number = PhoneNumber.fromInternational(c.counterpart);
  return number === null ? null : lineChatId(number);
}

export class CatchUpChatUseCase implements CatchUpChat {
  constructor(private readonly d: CatchUpChatDeps) {}

  async execute(q: { chat: ChatId; waitMs?: number }): Promise<Result> {
    if (!(await this.d.lease.isOwner())) return { kind: "refused", reason: "not_owner" };
    const waitMs = q.waitMs ?? CALLER_WAIT_MS;
    const timeout = this.d.clock.sleep(waitMs).then((): Result => ({ kind: "failed", reason: "timeout" }));
    return Promise.race([this.read(q.chat, waitMs), timeout]);
  }

  private async read(chat: ChatId, waitMs: number): Promise<Result> {
    const { provider, clock, uow, reads } = this.d;
    const dev = provider.name === "dev";
    try {
      if ((await this.d.coordinator.waitIdle(waitMs)) === "timeout") return { kind: "failed", reason: "timeout" };
      const signal = new AbortController().signal;
      const totals = new RunTotals();
      const sweep = {
        provider,
        uow,
        store: this.d.store,
        signal,
        totals,
        budget: new RunBudget(clock, Number.POSITIVE_INFINITY, totals),
      };

      const before = await reads.chats.get(chat, dev);
      const ref = before?.conversationRef ?? (await this.findConversation(chat, signal));
      if (ref !== null) {
        const newest = before === null ? null : latestOf(before);
        const from = newest === null ? null : newest - OVERLAP_MS;
        await walkPages({
          budget: sweep.budget,
          start: null,
          from,
          fetch: (cursor) => provider.listMessages({ scope: { conversationRef: ref }, cursor, limit: PAGE_SIZE }, signal),
          onPage: async (page) => {
            await storePage(sweep, page.items);
          },
        });
      }
      const outbound = await provider.listMessages({ scope: { outbound: true }, cursor: null, limit: PAGE_SIZE }, signal);
      await storePage(sweep, outbound.items);

      this.publish(totals);
      return { kind: "fresh", state: await this.view(chat, dev), newMessages: totals.stored };
    } catch (e) {
      if (e instanceof LeaseLostError) return { kind: "refused", reason: "not_owner" };
      return { kind: "failed", reason: failureOf(e) };
    }
  }

  /** A chat with no stored conversation: the one active in the last day whose counterpart gives this chat. */
  private async findConversation(chat: ChatId, signal: AbortSignal): Promise<string | null> {
    const activeAfter = this.d.clock.now() - CHAT_LOOKUP_WINDOW_MS;
    const walk = new PageWalk();
    let cursor: Cursor | null = null;
    for (;;) {
      walk.request(cursor);
      const page = await this.d.provider.listConversations({ activeAfter, cursor, limit: PAGE_SIZE }, signal);
      const found = page.items.find((c) => chatOfConversation(c) === chat);
      if (found !== undefined) return found.ref;
      if (page.next === null) return null;
      cursor = page.next;
    }
  }

  private publish(totals: RunTotals): void {
    publishEach(this.d.publisher, storedEvents("catch_up", totals.summaries(), totals.unlinkedOwnerReplies, this.d.clock.now()));
  }

  private async view(chat: ChatId, dev: boolean): Promise<ChatStateView> {
    const { reads, clock } = this.d;
    const state: ChatState = (await reads.chats.get(chat, dev)) ?? {
      chat,
      dev,
      mark: chatMarkOf(chat),
      conversationRef: null,
      providerId: null,
      lastCustomerAt: null,
      lastCustomerMessageId: null,
      lastAnswerAt: null,
      lastAnswerSource: null,
      lastUnattributedAt: null,
      profileName: null,
      profileNameAt: null,
      updatedAt: clock.now(),
    };
    return toChatStateView(state, await reads.messages.newestUnattributedStoredAt(dev));
  }
}
