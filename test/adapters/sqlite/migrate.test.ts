import { afterEach, beforeEach, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate, type MigrationFile } from "../../../src/adapters/sqlite/migrate";
import { num } from "../../../src/adapters/sqlite/row";

const files: MigrationFile[] = [
  { name: "0001", sql: "CREATE TABLE a (v INTEGER);" },
  { name: "0002", sql: "CREATE TABLE b (v INTEGER); INSERT INTO b VALUES (1);" },
  { name: "0003", sql: "CREATE TABLE c (v INTEGER);" },
];

let dir: string;
let path: string;
let db: ReturnType<typeof openBunSqlite>;
const backup = () => ({
  basePath: path,
  copyTo: async (p: string) => copyFileSync(path, p),
});
const version = async () => num((await db.query("PRAGMA user_version"))[0]!, "user_version");
const tables = async () =>
  (await db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).map((r) => String(r["name"]));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "deputy-mig-"));
  path = join(dir, "deputy.db");
  db = openBunSqlite({ path });
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("empty database migrates to the last file", async () => {
  expect(await migrate(db, files, backup())).toEqual({ kind: "migrated", from: 0, to: 3 });
  expect(await version()).toBe(3);
  expect(await tables()).toEqual(["a", "b", "c"]);
});

test("a failing file leaves version and data as before", async () => {
  const bad = [...files.slice(0, 2), { name: "0003", sql: "CREATE TABL oops;" }];
  await expect(migrate(db, bad, backup())).rejects.toThrow();
  expect(await version()).toBe(0);
  expect(await tables()).toEqual([]);
});

test("version 1 database is backed up, kept and brought to 3", async () => {
  await migrate(db, files.slice(0, 1), backup());
  await db.run("INSERT INTO a VALUES (7)");
  expect(await migrate(db, files, backup())).toEqual({ kind: "migrated", from: 1, to: 3 });
  expect(existsSync(`${path}.bak-v1`)).toBe(true);
  expect((await db.query("SELECT v FROM a"))[0]!["v"]).toBe(7);
  expect(await version()).toBe(3);
});

test("database newer than the binary is left alone", async () => {
  await migrate(db, files, backup());
  const result = await migrate(db, files.slice(0, 2), backup());
  expect(result).toEqual({ kind: "newer_than_binary", found: 3, known: 2 });
  expect(await version()).toBe(3);
});

test("two migrations started together: one migrates, the other finds current", async () => {
  const results = await Promise.all([migrate(db, files, backup()), migrate(db, files, backup())]);
  expect(results.map((r) => r.kind).sort()).toEqual(["current", "migrated"]);
});

test("fixtures of every released version survive migration", async () => {
  const fixtures = join(import.meta.dir, "../../fixtures/db");
  if (!existsSync(fixtures)) return;
  for (const f of readdirSync(fixtures).filter((n) => /^v\d+\.sqlite$/.test(n))) {
    const copy = join(dir, f);
    copyFileSync(join(fixtures, f), copy);
    const old = openBunSqlite({ path: copy });
    const result = await migrate(old, files, { basePath: copy, copyTo: async (p) => copyFileSync(copy, p) });
    expect(result.kind).toBe("migrated");
    expect(num((await old.query("PRAGMA user_version"))[0]!, "user_version")).toBe(files.length);
    old.close();
  }
});
