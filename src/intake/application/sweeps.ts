import type { Instant } from "../../shared/instant";
import type { Clock } from "../../shared/clock";
import { MAX_PAGES, PAGE_SIZE } from "../domain/constants";
import type { StoredReason, SyncState } from "../domain/sync-state";
import type { IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import { ProviderError, toCursor, type Cursor, type Provider, type ProviderConversation, type ProviderMessage, type Page } from "../ports/provider";
import type { StoredSummary, StoreMessages } from "./store-messages";

/** What a run stored so far, folded for the one MessageStored it publishes. */
export class RunTotals {
  stored = 0;
  /** A page was stored or a mark moved in this run: what separates a run that is catching up from one that is stuck. */
  moved = false;
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

/** A run that must stop with this reason: the budget is spent, or a listing is broken. */
export class RunStopped extends Error {
  constructor(readonly reason: StoredReason) {
    super(reason);
  }
}

/** The 60-second budget of a run, checked before each provider request. */
export class RunBudget {
  constructor(
    private readonly clock: Clock,
    private readonly deadline: Instant,
    private readonly totals: RunTotals,
  ) {}

  check(): void {
    if (this.clock.now() >= this.deadline) throw new RunStopped(this.totals.moved ? "catching_up" : "timeout");
  }
}

/** Guards one listing: a cursor the provider repeats, or more than MAX_PAGES requests, is a broken listing (bad_response). */
export class PageWalk {
  private readonly seen = new Set<string>();
  private requests = 0;

  /** Call with the cursor of every request about to be made. */
  request(cursor: Cursor | null): void {
    const key = cursor === null ? "<start>" : `cursor:${cursor}`;
    if (this.seen.has(key) || this.requests >= MAX_PAGES) throw new RunStopped("bad_response");
    this.requests++;
    this.seen.add(key);
  }
}

export interface SweepDeps {
  budget: RunBudget;
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
  budget: RunBudget,
): Promise<T[]> {
  const walk = new PageWalk();
  walk.request(null);
  const items = [...first.items];
  let page = first;
  while (page.next !== null) {
    budget.check();
    walk.request(page.next);
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
    let cursor: Cursor | null = null;
    const walk = new PageWalk();
    for (;;) {
      d.budget.check();
      walk.request(cursor);
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
  let walk = new PageWalk();
  for (;;) {
    let page: Page<ProviderMessage>;
    d.budget.check();
    walk.request(cursor);
    try {
      page = await d.provider.listMessages({ scope: { outbound: true }, cursor, limit: PAGE_SIZE }, d.signal);
    } catch (e) {
      if (!(firstRequest && cursor !== null && e instanceof ProviderError && e.kind === "bad_response")) throw e;
      cursor = null;
      runStart = d.providerNow;
      firstRequest = false;
      walk = new PageWalk();
      continue;
    }
    firstRequest = false;
    d.state.countStored(await storePage(d, page.items));
    const from = d.from;
    const reachedOlder = from !== null && page.items.some((m) => m.sentAt < from);
    if (reachedOlder || page.next === null) break;
    cursor = page.next;
    d.state.saveOutboundResume({ cursor, from: d.from, runStart });
    d.totals.moved = true;
    await d.uow.run((r) => r.syncState.save(d.state));
  }
  d.state.completeOutbound(runStart);
}
