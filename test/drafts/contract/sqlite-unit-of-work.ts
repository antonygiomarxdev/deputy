import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";
import { SqliteUnitOfWork } from "../../../src/drafts/adapters/sqlite/sqlite-unit-of-work";
import type { Transaction, UnitOfWork } from "../../../src/drafts/ports/outbound";
import type { OwnerLease } from "../../../src/shared/owner-lease";

const root = join(import.meta.dir, "..", "..", "..");
const sql = (p: string) => readFileSync(join(root, p), "utf8");

export const DRAFTS_MIGRATIONS = [
  { name: "0001-shared", sql: sql("src/adapters/sqlite/migrations/0001-shared.sql") },
  { name: "0001-drafts", sql: sql("src/drafts/adapters/sqlite/migrations/0001-drafts.sql") },
  { name: "0002-log", sql: sql("src/drafts/adapters/sqlite/migrations/0002-log.sql") },
  { name: "0003-approvals", sql: sql("src/drafts/adapters/sqlite/migrations/0003-approvals.sql") },
];

const closers: (() => void)[] = [];
export function closeSqliteUnitsOfWork(): void {
  for (const c of closers.splice(0)) c();
}

/** The factories of the contracts are synchronous, so the migration runs before the first call. */
export function sqliteUnitOfWork(lease: OwnerLease): UnitOfWork {
  const db = openBunSqlite({ path: ":memory:" });
  closers.push(() => db.close());
  const ready = migrate(db, DRAFTS_MIGRATIONS, { basePath: ":memory:", copyTo: async () => {} });
  const inner = new SqliteUnitOfWork(db, lease);
  return {
    read: async (work) => {
      await ready;
      return inner.read(work);
    },
    async run<T>(work: (tx: Transaction) => Promise<T>, options?: { requireLease?: boolean }) {
      await ready;
      return inner.run(work, options);
    },
  };
}
