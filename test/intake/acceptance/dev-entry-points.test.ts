import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";
import { DevProvider } from "../../../src/intake/adapters/dev/dev-provider";
import { FakeClock } from "../../support/fake-clock";

import type { Provider } from "../../../src/intake/ports/provider";
const port = (p: Provider): Provider => p;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

async function dev() {
  const dir = mkdtempSync(join(tmpdir(), "deputy-dev-"));
  const path = join(dir, "deputy.db");
  const db = openBunSqlite({ path });
  cleanups.push(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const sql = readFileSync(join(import.meta.dir, "../../../src/intake/adapters/sqlite/migrations/0002-dev-holdings.sql"), "utf8");
  await migrate(db, [{ name: "0001", sql: "CREATE TABLE x (v INTEGER);" }, { name: "0002", sql }], { basePath: path, copyTo: async () => {} });
  return new DevProvider({ db, clock: new FakeClock(1_000_000) });
}

test("FR-INTAKE-01-6: hold stores a body once; holding the same id again is not new", async () => {
  const provider = await dev();
  const first = await provider.hold({ chat: "c", from: "1555", text: "hi", providerMessageId: "dev-fixed" });
  expect(first).toEqual({ providerMessageId: "dev-fixed", isNew: true });
  expect((await provider.hold({ chat: "c", from: "1555", text: "hi", providerMessageId: "dev-fixed" })).isNew).toBe(false);
  const list = await port(provider).listMessages({ scope: { conversationRef: "c" }, cursor: null, limit: 10 }, new AbortController().signal);
  expect(list.items).toHaveLength(1);
});

test("a held body without an id gets dev-in-<seq>; an owner body gets dev-out-<seq>", async () => {
  const provider = await dev();
  expect((await provider.hold({ chat: "c", from: "1555", text: "a" })).providerMessageId).toMatch(/^dev-in-\d+$/);
  expect((await provider.hold({ chat: "c", from: "1555", text: "b", owner: true })).providerMessageId).toMatch(/^dev-out-\d+$/);
});

test("only a duplicate id is ignored: another constraint failure surfaces", async () => {
  const provider = await dev();
  await expect(provider.hold({ chat: "c", from: "1555", text: "x", sentAt: Number.NaN })).rejects.toThrow();
});

test("a limit below 1 is refused at the port", async () => {
  const provider = await dev();
  const signal = new AbortController().signal;
  await expect(port(provider).listMessages({ scope: { outbound: true }, cursor: null, limit: 0 }, signal)).rejects.toThrow(RangeError);
  await expect(port(provider).listConversations({ activeAfter: null, cursor: null, limit: -1 }, signal)).rejects.toThrow(RangeError);
});
