import { Database } from "bun:sqlite";
import type { SqlDatabase, SqlExecutor, SqlRow, SqlValue } from "../../shared/sql-database";
import { createSerializer } from "../serial";

export interface OpenOptions {
  path: string;
  busyTimeoutMs?: number;
}

function executor(db: Database): SqlExecutor {
  return {
    async query(sql, params = []) {
      // bun:sqlite returns plain objects of column to value; SqlValue is the same set (no bigint without safeIntegers).
      return db.query(sql).all(...(params as SqlValue[])) as SqlRow[];
    },
    async run(sql, params) {
      const r = params === undefined ? db.run(sql) : db.run(sql, params as SqlValue[]);
      return { changes: r.changes, lastInsertId: Number(r.lastInsertRowid) };
    },
  };
}

export function openBunSqlite(o: OpenOptions): SqlDatabase & { close(): void } {
  const db = new Database(o.path, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run(`PRAGMA busy_timeout = ${Math.trunc(o.busyTimeoutMs ?? 5000)}`);
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA secure_delete = ON");
  const direct = executor(db);

  // One queue: a call from another caller never lands inside an open transaction.
  const enqueue = createSerializer();

  return {
    query: (sql, params) => enqueue(() => direct.query(sql, params)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)),
    transaction: (work) =>
      enqueue(async () => {
        db.run("BEGIN IMMEDIATE");
        try {
          const result = await work(direct);
          db.run("COMMIT");
          return result;
        } catch (e) {
          db.run("ROLLBACK");
          throw e;
        }
      }),
    close: () => db.close(),
  };
}
