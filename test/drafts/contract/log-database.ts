import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";
import { SqliteDraftRepository } from "../../../src/drafts/adapters/sqlite/sqlite-draft-repository";
import type { ChatId } from "../../../src/shared/chat-id";
import { newDraft } from "./draft-repository.contract";

const root = join(import.meta.dir, "..", "..", "..");
const sql = (p: string) => readFileSync(join(root, p), "utf8");

const open: { close(): void }[] = [];
export function closeLogDatabases(): void {
  for (const db of open.splice(0)) db.close();
}

export async function openLogDatabase() {
  const db = openBunSqlite({ path: ":memory:" });
  open.push(db);
  await migrate(
    db,
    [
      { name: "0001-shared", sql: sql("src/adapters/sqlite/migrations/0001-shared.sql") },
      { name: "0001-drafts", sql: sql("src/drafts/adapters/sqlite/migrations/0001-drafts.sql") },
      { name: "0002-log", sql: sql("src/drafts/adapters/sqlite/migrations/0002-log.sql") },
    ],
    { basePath: ":memory:", copyTo: async () => {} },
  );
  // drafts_log.draft_number is a foreign key: the contract's draft numbers 1 to 10 must exist.
  const drafts = new SqliteDraftRepository(db);
  for (let n = 1; n <= 10; n++) await drafts.save(newDraft(n, "reply", `seed-${n}` as ChatId));
  return db;
}
