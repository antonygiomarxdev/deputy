import type { Instant } from "../../shared/instant";
import { PAGE_SIZE } from "../domain/constants";
import type { SyncState } from "../domain/sync-state";
import type { IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import { ProviderError, toCursor, type Cursor, type Provider, type ProviderConversation, type ProviderMessage } from "../ports/provider";
import { walkPages } from "./page-walk";
import { RunBudget, type RunTotals } from "./run-state";
import type { StoreMessages } from "./store-messages";

export interface SweepDeps {
  budget: RunBudget;
  provider: Provider;
  uow: IntakeUnitOfWork;
  store: StoreMessages;
  signal: AbortSignal;
  totals: RunTotals;
}

const olderOf = (oldest: Instant | null, items: readonly ProviderMessage[]): Instant | null =>
  items.reduce<Instant | null>((acc, m) => (acc === null || m.sentAt < acc ? m.sentAt : acc), oldest);

/** Stores one page in its own transaction, oldest item first, so a failure keeps what was stored. */
export async function storePage(d: SweepDeps, items: readonly ProviderMessage[]): Promise<number> {
  const events = [...items].reverse().map((message) => ({ kind: "message" as const, message }));
  const outcome = await d.uow.run((r) => d.store.store(r, { provider: d.provider.name, events }));
  d.totals.add(outcome);
  d.totals.moved = true;
  return outcome.stored;
}

/**
 * Sweep 1: each conversation active since `from`, oldest activity first. A conversation is read newest first and stops at a page that
 * holds an item older than `from`, or when its listing ends. The mark advances after each conversation, so a stopped run resumes there.
 */
export async function sweepConversations(
  d: SweepDeps & { state: SyncState; conversations: readonly ProviderConversation[]; from: Instant | null },
): Promise<void> {
  const ordered = [...d.conversations].sort((a, b) => a.lastActiveAt - b.lastActiveAt);
  for (const conversation of ordered) {
    let oldest: Instant | null = null;
    const exhausted = await walkPages({
      budget: d.budget,
      start: null,
      from: d.from,
      fetch: (cursor) => d.provider.listMessages({ scope: { conversationRef: conversation.ref }, cursor, limit: PAGE_SIZE }, d.signal),
      onPage: async (page) => {
        d.state.countStored(await storePage(d, page.items));
        oldest = olderOf(oldest, page.items);
      },
    });
    d.totals.listings.push({ scope: { conversationRef: conversation.ref }, exhausted, oldestReturned: oldest });
    d.state.advanceConversations(conversation.lastActiveAt);
    d.totals.moved = true;
    await d.uow.run((r) => r.syncState.save(d.state));
  }
}

/**
 * Sweep 2: the outbound listing, newest first, until an item older than `from` or its end. Owner echoes that did not move a
 * conversation's activity show up only here. After each page the cursor is saved, so a stopped run continues with the same window;
 * a provider that refuses that cursor makes the window start again without one.
 */
export async function sweepOutbound(d: SweepDeps & { state: SyncState; from: Instant | null; providerNow: Instant }): Promise<void> {
  const saved = d.state.props.outboundResume;
  const continuing = saved !== null && saved.from === d.from;
  let cursor: Cursor | null = continuing ? toCursor(saved.cursor) : null;
  // continuing keeps the first run's start: that run read from there, this one reads on from where it stopped
  let runStart = continuing ? saved.runStart : d.providerNow;
  let firstRequest = true;
  let oldest: Instant | null = null;
  for (;;) {
    try {
      const exhausted = await walkPages({
        budget: d.budget,
        start: cursor,
        from: d.from,
        fetch: (c) => d.provider.listMessages({ scope: { outbound: true }, cursor: c, limit: PAGE_SIZE }, d.signal),
        onPage: async (page) => {
          firstRequest = false;
          d.state.countStored(await storePage(d, page.items));
          oldest = olderOf(oldest, page.items);
        },
        onNext: async (next) => {
          d.state.saveOutboundResume({ cursor: next, from: d.from, runStart });
          d.totals.moved = true;
          await d.uow.run((r) => r.syncState.save(d.state));
        },
      });
      d.totals.listings.push({ scope: { ownerOrDeputy: true }, exhausted, oldestReturned: oldest });
      d.state.completeOutbound(runStart);
      return;
    } catch (e) {
      if (!(firstRequest && cursor !== null && e instanceof ProviderError && e.kind === "bad_response")) throw e;
      cursor = null;
      runStart = d.providerNow;
      firstRequest = false;
    }
  }
}
