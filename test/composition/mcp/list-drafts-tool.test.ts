import { describe, expect, test } from "bun:test";
import { listDraftsTool, type CatalogChangedSince } from "../../../src/composition/mcp/list-drafts-tool";
import type { DraftView, ListDrafts } from "../../../src/drafts/index";

const view = (over: Partial<DraftView> = {}): DraftView => ({
  number: 1,
  kind: "reply",
  chat: "+15557654321",
  state: "waiting",
  text: "It costs 10",
  madeAt: "2026-11-18T10:00:00.000Z",
  answers: null,
  catalogChanged: false,
  holdReason: null,
  failReason: null,
  fromEarlierSession: false,
  retryAt: null,
  ...over,
});

const tool = (drafts: DraftView[], check: CatalogChangedSince) =>
  listDraftsTool({ listDrafts: { run: async () => ({ ok: true, value: drafts }) } satisfies ListDrafts, catalogChangedSince: check });

describe("list_drafts and the catalog check", () => {
  test("no drafts: the text says so and the check is not called", async () => {
    let calls = 0;
    const r = await tool([], async () => {
      calls++;
      return [];
    }).run({});
    expect(r).toMatchObject({ text: "no drafts waiting", isError: false });
    expect(calls).toBe(0);
  });

  // covers: knowledge/FRD-01/EX-25
  // covers: knowledge/FRD-01/EX-26
  test("the check is called once, with every draft's madeAt, and a 'changed' answer shows the mark", async () => {
    const seen: string[][] = [];
    const r = await tool([view({ number: 1 }), view({ number: 2, madeAt: "2026-11-18T11:00:00.000Z" })], async (since) => {
      seen.push(since);
      return ["changed", "unchanged"];
    }).run({});
    expect(seen).toEqual([["2026-11-18T10:00:00.000Z", "2026-11-18T11:00:00.000Z"]]);
    const [first, second] = r.text.split("\n\n");
    expect(first).toContain("catalog changed");
    expect(second).not.toContain("catalog changed");
    expect(second).not.toContain("catalog_check_unavailable");
  });

  test("'unknown' shows catalog_check_unavailable and no mark", async () => {
    const r = await tool([view()], async () => ["unknown"]).run({});
    expect(r.text).toContain("code: catalog_check_unavailable");
    expect(r.text).not.toContain("catalog changed");
  });

  test("an order draft whose revalidate says changed shows the mark although the time check says unchanged", async () => {
    const r = await tool([view({ kind: "order", catalogChanged: true })], async () => ["unchanged"]).run({});
    expect(r.text).toContain("catalog changed");
  });

  test("a check that throws is the same as unknown", async () => {
    const r = await tool([view()], async () => {
      throw new Error("knowledge down");
    }).run({});
    expect(r.isError).toBe(false);
    expect(r.text).toContain("code: catalog_check_unavailable");
    expect(r.text).not.toContain("knowledge down");
  });

  test("a refusal is returned with its code", async () => {
    const t = listDraftsTool({
      listDrafts: { run: async () => ({ ok: false, refusal: { code: "not_owner" } }) },
      catalogChangedSince: async () => [],
    });
    expect(await t.run({})).toMatchObject({ isError: true, structured: { code: "not_owner" } });
  });

  test("an answered message that is gone is shown as unavailable", async () => {
    const r = await tool([view({ answers: { unavailable: true } })], async () => ["unchanged"]).run({});
    expect(r.text).toContain("answers: a message that is no longer available");
  });
});
