import type { Instant } from "../../shared/instant";
import { MAX_PAGES } from "../domain/constants";
import { type Cursor, type Page, type ProviderMessage } from "../ports/provider";
import { RunBudget, RunStopped } from "./run-state";

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

/**
 * One listing read newest first from `start`, one guarded request at a time. A page that holds an item older than `from` or that
 * ends the listing stops it; `onPage` sees every page read and `onNext` each cursor the walk goes on from. Returns true when the
 * listing ended.
 */
export async function walkPages(p: {
  budget: RunBudget;
  start: Cursor | null;
  from: Instant | null;
  fetch: (cursor: Cursor | null) => Promise<Page<ProviderMessage>>;
  onPage: (page: Page<ProviderMessage>) => Promise<void>;
  onNext?: (cursor: Cursor) => Promise<void>;
}): Promise<boolean> {
  const walk = new PageWalk();
  let cursor = p.start;
  for (;;) {
    p.budget.check();
    walk.request(cursor);
    const page = await p.fetch(cursor);
    await p.onPage(page);
    const from = p.from;
    const reachedOlder = from !== null && page.items.some((m) => m.sentAt < from);
    if (reachedOlder || page.next === null) return page.next === null;
    cursor = page.next;
    await p.onNext?.(cursor);
  }
}
