import { afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";
import { SqliteUnitOfWork } from "../../../src/drafts/adapters/sqlite/sqlite-unit-of-work";
import type { DraftRepository, UnitOfWork } from "../../../src/drafts/ports/outbound";
import { draftRepositoryContract } from "./draft-repository.contract";

const root = join(import.meta.dir, "..", "..", "..");
const sql = (p: string) => readFileSync(join(root, p), "utf8");

const closers: (() => void)[] = [];
afterEach(() => {
  for (const c of closers.splice(0)) c();
});

// The contract's factory is synchronous, so the migration runs on the first transaction.
draftRepositoryContract("SQLite", (lease): UnitOfWork => {
  const db = openBunSqlite({ path: ":memory:" });
  closers.push(() => db.close());
  const ready = migrate(
    db,
    [
      { name: "0001-shared", sql: sql("src/adapters/sqlite/migrations/0001-shared.sql") },
      { name: "0001-drafts", sql: sql("src/drafts/adapters/sqlite/migrations/0001-drafts.sql") },
    ],
    { basePath: ":memory:", copyTo: async () => {} },
  );
  const inner = new SqliteUnitOfWork(db, lease);
  return {
    async run<T>(work: (tx: { drafts: DraftRepository }) => Promise<T>, options?: { requireLease?: boolean }) {
      await ready;
      return inner.run(work, options);
    },
  };
});
