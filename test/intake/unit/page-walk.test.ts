import { expect, test } from "bun:test";
import { PageWalk, walkPages } from "../../../src/intake/application/page-walk";
import { RunBudget, RunStopped, RunTotals } from "../../../src/intake/application/run-state";
import { MAX_PAGES } from "../../../src/intake/domain/constants";
import { toCursor, type Cursor, type Page, type ProviderMessage } from "../../../src/intake/ports/provider";
import { FakeClock } from "../../support/fake-clock";
import { providerMessage } from "../../support/intake-fixtures";

/** The reason a request stops the walk, or null when it is allowed. */
const stopReason = (request: () => void): string | null => {
  try {
    request();
    return null;
  } catch (e) {
    return e instanceof RunStopped ? e.reason : "not a RunStopped";
  }
};

test("PageWalk allows the start once and each new cursor", () => {
  const walk = new PageWalk();
  expect(stopReason(() => walk.request(null))).toBeNull();
  expect(stopReason(() => walk.request(toCursor("a")))).toBeNull();
  expect(stopReason(() => walk.request(toCursor("b")))).toBeNull();
});

test("PageWalk stops a repeated cursor and a repeated start as bad_response", () => {
  const walk = new PageWalk();
  walk.request(null);
  walk.request(toCursor("a"));
  expect(stopReason(() => walk.request(toCursor("a")))).toBe("bad_response");
  expect(stopReason(() => walk.request(null))).toBe("bad_response");
});

test("PageWalk stops a listing that asks for more than MAX_PAGES pages as bad_response", () => {
  const walk = new PageWalk();
  for (let i = 0; i < MAX_PAGES; i++) walk.request(toCursor(`p${i}`));
  expect(stopReason(() => walk.request(toCursor("one-more")))).toBe("bad_response");
});

test("walkPages stops at an older item, and reads to the end when there is no bound", async () => {
  const at = (sentAt: number): ProviderMessage => providerMessage({ sentAt });
  const page = (items: ProviderMessage[], next: Cursor | null): Page<ProviderMessage> => ({ items, next, serverTime: 0, remaining: null });
  const pages = new Map<string | null, Page<ProviderMessage>>([
    [null, page([at(300)], toCursor("p2"))],
    ["p2", page([at(100)], toCursor("p3"))],
    ["p3", page([at(50)], null)],
  ]);
  const fetch = async (cursor: Cursor | null): Promise<Page<ProviderMessage>> => {
    const p = pages.get(cursor);
    if (p === undefined) throw new Error(`no page for ${cursor}`);
    return p;
  };
  const budget = new RunBudget(new FakeClock(0), Number.POSITIVE_INFINITY, new RunTotals());

  // from 200: the page holding 100 is older than the bound, so the walk stops there and never asks for p3
  const names: string[] = [];
  const stoppedEarly = await walkPages({
    budget,
    start: null,
    from: 200,
    fetch,
    onPage: async () => {},
    onNext: async (cursor) => {
      names.push(cursor);
    },
  });
  expect(stoppedEarly).toBe(false);
  expect(names).toEqual(["p2"]);

  // no bound: every page is read and the listing ends
  expect(await walkPages({ budget, start: null, from: null, fetch, onPage: async () => {} })).toBe(true);
});
