import type { SqlDatabase, SqlExecutor } from "../../shared/sql-database";
import { num } from "./row";

export interface MigrationFile {
  readonly name: string;
  readonly sql: string;
}

export type MigrateResult =
  | { kind: "migrated"; from: number; to: number }
  | { kind: "current"; version: number }
  | { kind: "newer_than_binary"; found: number; known: number };

async function readVersion(db: SqlExecutor): Promise<number> {
  const [row] = await db.query("PRAGMA user_version");
  return row ? num(row, "user_version") : 0;
}

/** A file is numbered by its position in `files` (the first is 1). */
export async function migrate(
  db: SqlDatabase,
  files: readonly MigrationFile[],
  backup: { copyTo(path: string): Promise<void>; basePath: string },
): Promise<MigrateResult> {
  const known = files.length;
  const before = await readVersion(db);
  // shortcut: a write landing between this checkpoint and BEGIN leaves it in the WAL, so the backup misses it; upgrade if migrations ever run while another process writes.
  if (before > 0 && before < known) await db.query("PRAGMA wal_checkpoint(TRUNCATE)");
  return db.transaction(async (tx) => {
    const found = await readVersion(tx);
    if (found > known) return { kind: "newer_than_binary", found, known };
    if (found === known) return { kind: "current", version: found };
    if (found > 0) await backup.copyTo(`${backup.basePath}.bak-v${found}`);
    for (const file of files.slice(found)) await tx.run(file.sql);
    await tx.run(`PRAGMA user_version = ${known}`);
    return { kind: "migrated", from: found, to: known };
  });
}
