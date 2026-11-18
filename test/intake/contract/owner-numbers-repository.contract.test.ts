import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";
import { InMemoryOwnerNumbersRepository } from "../../../src/intake/adapters/memory/in-memory-owner-numbers-repository";
import { SqliteOwnerNumbersRepository } from "../../../src/intake/adapters/sqlite/sqlite-owner-numbers-repository";
import { OwnerNumbers, type OwnerNumberLogEntry } from "../../../src/intake/domain/owner-numbers";
import type { OwnerNumbersRepository } from "../../../src/intake/ports/owner-numbers-repository";
import { PhoneNumber } from "../../../src/shared/phone-number";

const root = join(import.meta.dir, "..", "..", "..");
const sql = (p: string) => readFileSync(join(root, p), "utf8");

function phone(raw: string): PhoneNumber {
  const n = PhoneNumber.fromInternational(raw);
  if (n === null) throw new Error(raw);
  return n;
}

const set = () => {
  const o = OwnerNumbers.empty();
  o.add({ number: phone("+50588880000"), kind: "business", label: "shop", addedAt: 10 });
  o.add({ number: phone("+50599990000"), kind: "extra", label: "", addedAt: 20 });
  return o;
};
const entries = (at: number): OwnerNumberLogEntry[] => [
  { at, action: "add", number: "+50588880000", kind: "business", label: "shop", command: "deputy config set business-number +50588880000" },
  { at: at + 1, action: "add", number: "+50599990000", kind: "extra", label: "", command: "deputy config set owner-numbers +50599990000" },
];

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

async function sqlite() {
  const dir = mkdtempSync(join(tmpdir(), "deputy-own-"));

  const path = join(dir, "deputy.db");
  const db = openBunSqlite({ path });
  cleanups.push(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });
  await migrate(
    db,
    [
      { name: "0001-shared", sql: sql("src/adapters/sqlite/migrations/0001-shared.sql") },
      { name: "0001-owner-numbers", sql: sql("src/intake/adapters/sqlite/migrations/0001-owner-numbers.sql") },
    ],
    { basePath: path, copyTo: async () => {} },
  );
  return { db, repo: new SqliteOwnerNumbersRepository(db) };
}

function contract(name: string, make: () => Promise<OwnerNumbersRepository>) {
  describe(name, () => {
    test("load and log return what was saved, log oldest first", async () => {
      const repo = await make();
      await repo.save(set(), entries(100));
      const loaded = await repo.load();
      expect(loaded.entries().map((e) => [e.number.e164, e.kind, e.label, e.addedAt])).toEqual([
        ["+50588880000", "business", "shop", 10],
        ["+50599990000", "extra", "", 20],
      ]);
      expect((await repo.log()).map((l) => l.at)).toEqual([100, 101]);
    });

    test("an empty repository loads an empty set", async () => {
      const repo = await make();
      expect((await repo.load()).entries()).toEqual([]);
    });
  });
}

contract("in-memory", async () => new InMemoryOwnerNumbersRepository());
contract("sqlite", async () => (await sqlite()).repo);

describe("sqlite only", () => {
  test("the log is append-only", async () => {
    const { db, repo } = await sqlite();
    await repo.save(set(), entries(100));
    await expect(db.run("UPDATE owner_number_log SET command = 'x'")).rejects.toThrow("append-only");
    await expect(db.run("DELETE FROM owner_number_log")).rejects.toThrow("append-only");
  });

  test("a failing log insert leaves the set unchanged", async () => {
    const { repo } = await sqlite();
    await repo.save(set(), entries(100));
    const next = OwnerNumbers.empty();
    const bad = { ...entries(200)[0]!, action: "bogus" as "add" };
    await expect(repo.save(next, [bad])).rejects.toThrow();
    expect((await repo.load()).entries()).toHaveLength(2);
    expect(await repo.log()).toHaveLength(2);
  });
});
