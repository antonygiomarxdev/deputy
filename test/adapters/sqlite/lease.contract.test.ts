import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";
import { createSqliteOwnerLease } from "../../../src/adapters/sqlite/sqlite-owner-lease";
import type { LeaseControl } from "../../../src/shared/owner-lease";
import { LEASE_RENEW_MS } from "../../../src/shared/lease-constants";
import { FakeClock } from "../../support/fake-clock";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";

interface Setup {
  clock: FakeClock;
  a: LeaseControl;
  b: LeaseControl;
  cleanup(): void;
  sqlite?: ReturnType<typeof openBunSqlite>;
}
type Factory = () => Promise<Setup>;

const inMemory: Factory = async () => {
  const clock = new FakeClock(1_000_000);
  const holder: LeaseHolder = { token: null, heartbeat: 0 };
  return { clock, a: new InMemoryOwnerLease(holder, clock, "a"), b: new InMemoryOwnerLease(holder, clock, "b"), cleanup() {} };
};

let n = 0;
const sqlite: Factory = async () => {
  const dir = mkdtempSync(join(tmpdir(), "deputy-lease-"));
  const path = join(dir, "deputy.db");
  const sql = await Bun.file(join(import.meta.dir, "../../../src/adapters/sqlite/migrations/0001-shared.sql")).text();
  const first = openBunSqlite({ path });
  await migrate(first, [{ name: "0001", sql }], { basePath: path, copyTo: async () => {} });
  const second = openBunSqlite({ path });
  const clock = new FakeClock(1_000_000);
  return {
    clock,
    a: createSqliteOwnerLease(first, clock, () => `a${n++}`),
    b: createSqliteOwnerLease(second, clock, () => `b${n++}`),
    sqlite: first,
    cleanup() {
      first.close();
      second.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
};

for (const [name, factory] of [["in-memory", inMemory], ["sqlite", sqlite]] as const) {
  describe(`OwnerLease (${name})`, () => {
    let s: Setup;
    beforeEach(async () => {
      s = await factory();
    });
    afterEach(() => s.cleanup());

    test("a free lease goes to the first caller only", async () => {
      expect(await s.a.tryAcquire()).toBe(true);
      expect(await s.b.tryAcquire()).toBe(false);
      expect(await s.a.isOwner()).toBe(true);
      expect(await s.b.isOwner()).toBe(false);
    });

    test("30 s without renewal lets the other take it", async () => {
      await s.a.tryAcquire();
      await s.clock.advance(LEASE_RENEW_MS);
      expect(await s.a.renew()).toBe(true);
      await s.clock.advance(30_001);
      expect(await s.b.tryAcquire()).toBe(true);
      expect(await s.a.isOwner()).toBe(false);
      expect(await s.a.renew()).toBe(false);
    });

    test("an expired lease seen by both goes to exactly one", async () => {
      await s.a.tryAcquire();
      await s.clock.advance(31_000);
      const wins = await Promise.all([s.a.tryAcquire(), s.b.tryAcquire()]);
      expect(wins.filter(Boolean)).toHaveLength(1);
    });

    test("release hands the lease over at once", async () => {
      await s.a.tryAcquire();
      await s.a.release();
      expect(await s.b.tryAcquire()).toBe(true);
    });
  });
}

test("isOwner(tx) sees a lease row deleted inside the transaction", async () => {
  const s = await sqlite();
  await s.a.tryAcquire();
  const db = s.sqlite!;
  const inside = await db.transaction(async (tx) => {
    await tx.run("DELETE FROM lease");
    return s.a.isOwner(tx);
  });
  expect(inside).toBe(false);
  s.cleanup();
});
