import type { Instant } from "../../shared/instant";
import { PAGE_SIZE } from "../domain/constants";
import type { SyncState } from "../domain/sync-state";
import type { IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import type { Cursor, Provider, ProviderConversation, ProviderMessage, Page } from "../ports/provider";
import type { StoredSummary, StoreMessages } from "./store-messages";

/** What a run stored so far, folded for the one MessageStored it publishes. */
export class RunTotals {
  stored = 0;
  unlinkedOwnerReplies = 0;
  private readonly counts = new Map<string, StoredSummary>();

  add(o: { stored: number; summaries: readonly StoredSummary[]; unlinkedOwnerReplies: number }): void {
    this.stored += o.stored;
    this.unlinkedOwnerReplies += o.unlinkedOwnerReplies;
    for (const s of o.summaries) {
      const key = `${s.chat}|${s.source}`;
      this.counts.set(key, { ...s, count: (this.counts.get(key)?.count ?? 0) + s.count });
    }
  }

  summaries(): StoredSummary[] {
    return [...this.counts.values()];
  }
}

export interface SweepDeps {
  provider: Provider;
  uow: IntakeUnitOfWork;
  store: StoreMessages;
  signal: AbortSignal;
  totals: RunTotals;
}

/** Every page of a listing, newest first, starting from a page already read. */
export async function readAll<T>(
  first: Page<T>,
  next: (cursor: Cursor) => Promise<Page<T>>,
): Promise<T[]> {
  const items = [...first.items];
  let page = first;
  while (page.next !== null) {
    page = await next(page.next);
    items.push(...page.items);
  }
  return items;
}

/** Stores one page in its own transaction, oldest item first, so a failure keeps what was stored. */
export async function storePage(d: SweepDeps, items: readonly ProviderMessage[]): Promise<number> {
  const events = [...items].reverse().map((message) => ({ kind: "message" as const, message }));
  const outcome = await d.uow.run((r) => d.store.store(r, { provider: d.provider.name, events }));
  d.totals.add(outcome);
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
    let cursor: Cursor | null = null;
    for (;;) {
      const page: Page<ProviderMessage> = await d.provider.listMessages(
        { scope: { conversationRef: conversation.ref }, cursor, limit: PAGE_SIZE },
        d.signal,
      );
      d.state.countStored(await storePage(d, page.items));
      const from = d.from;
      const reachedOlder = from !== null && page.items.some((m) => m.sentAt < from);
      if (reachedOlder || page.next === null) break;
      cursor = page.next;
    }
    d.state.advanceConversations(conversation.lastActiveAt);
    await d.uow.run((r) => r.syncState.save(d.state));
  }
}
