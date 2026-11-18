import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { num, str } from "../../../src/adapters/sqlite/row";

let dir: string;
let db: ReturnType<typeof openBunSqlite>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "deputy-db-"));
  db = openBunSqlite({ path: join(dir, "t.db") });
  await db.run("CREATE TABLE t (v TEXT)");
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("pragmas are set at open", async () => {
  const pragma = async (name: string) => (await db.query(`PRAGMA ${name}`))[0];
  expect(num((await pragma("secure_delete"))!, "secure_delete")).toBe(1);
  expect(str((await pragma("journal_mode"))!, "journal_mode")).toBe("wal");
  expect(num((await pragma("busy_timeout"))!, "timeout")).toBe(5000);
});

test("a throwing transaction rolls back and rethrows", async () => {
  await expect(
    db.transaction(async (tx) => {
      await tx.run("INSERT INTO t VALUES ('x')");
      throw new Error("boom");
    }),
  ).rejects.toThrow("boom");
  expect(await db.query("SELECT * FROM t")).toHaveLength(0);
});

test("transactions run one after the other and a plain query is outside both", async () => {
  const log: string[] = [];
  const slow = (name: string) =>
    db.transaction(async (tx) => {
      log.push(`${name}:start`);
      await tx.run("INSERT INTO t VALUES (?)", [name]);
      await new Promise((r) => setTimeout(r, 20));
      log.push(`${name}:end`);
    });
  const a = slow("a");
  const b = slow("b");
  const q = db.query("SELECT * FROM t").then((rows) => {
    log.push(`query:${rows.length}`);
  });
  await Promise.all([a, b, q]);
  expect(log).toEqual(["a:start", "a:end", "b:start", "b:end", "query:2"]);
});
