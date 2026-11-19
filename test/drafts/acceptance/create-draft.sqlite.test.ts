import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";
import { SqliteUnitOfWork } from "../../../src/drafts/adapters/sqlite/sqlite-unit-of-work";
import type { UnitOfWork } from "../../../src/drafts/ports/store";
import { makeDrafts, message } from "./harness";

const root = join(import.meta.dir, "..", "..", "..");
const sql = (p: string) => readFileSync(join(root, p), "utf8");

const open: { close(): void }[] = [];
afterEach(() => {
  for (const db of open.splice(0)) db.close();
});

// SQLite with foreign keys on: the replaced_by reference is checked at commit.
async function sqliteDrafts() {
  const db = openBunSqlite({ path: ":memory:" });
  open.push(db);
  await migrate(
    db,
    [
      { name: "0001-shared", sql: sql("src/adapters/sqlite/migrations/0001-shared.sql") },
      { name: "0001-drafts", sql: sql("src/drafts/adapters/sqlite/migrations/0001-drafts.sql") },
      { name: "0002-log", sql: sql("src/drafts/adapters/sqlite/migrations/0002-log.sql") },
      { name: "0003-approvals", sql: sql("src/drafts/adapters/sqlite/migrations/0003-approvals.sql") },
    ],
    { basePath: ":memory:", copyTo: async () => {} },
  );
  let uow: UnitOfWork | null = null;
  const h = makeDrafts({
    chats: { "chat-a": [message("m1", "customer", "How much?", 900)] },
    unitOfWork: (_store, lease) => (uow = new SqliteUnitOfWork(db, lease)),
  });
  if (!uow) throw new Error("unit of work not built");
  return { h, uow: uow as UnitOfWork };
}

test("FR-DRAFTS-01-7: a replace saves the old draft first and the new one second, in one SQLite transaction", async () => {
  const { h, uow } = await sqliteDrafts();
  const first = await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "one" });
  const second = await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "two" });
  if (!first.ok || !second.ok) throw new Error("refused");
  expect(second.value.replaced).toEqual({ number: first.value.number, state: "waiting" });
  const old = await uow.run((tx) => tx.drafts.get(first.value.number));
  expect(old?.snapshot()).toMatchObject({ state: "replaced", replacedBy: second.value.number });
  const open = await uow.run((tx) => tx.drafts.listOpen());
  expect(open.map((d) => d.snapshot().number)).toEqual([second.value.number]);
  const log = await uow.run((tx) => tx.log.page({ after: 0, limit: 10 }));
  expect(log.map((e) => e.kind)).toEqual(["proposed", "replaced", "proposed"]);
});
