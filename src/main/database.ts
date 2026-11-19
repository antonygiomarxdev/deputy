import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { openBunSqlite } from "../adapters/sqlite/bun-sqlite-database";
import { migrate } from "../adapters/sqlite/migrate";
import sharedSql from "../adapters/sqlite/migrations/0001-shared.sql" with { type: "text" };
import ownerNumbersSql from "../intake/adapters/sqlite/migrations/0001-owner-numbers.sql" with { type: "text" };
import devHoldingsSql from "../intake/adapters/sqlite/migrations/0002-dev-holdings.sql" with { type: "text" };
import messagesSql from "../intake/adapters/sqlite/migrations/0003-messages.sql" with { type: "text" };
import outgoingSql from "../intake/adapters/sqlite/migrations/0004-outgoing.sql" with { type: "text" };
import catchupStatusSql from "../intake/adapters/sqlite/migrations/0005-catchup-status.sql" with { type: "text" };
import outgoingRetrySql from "../intake/adapters/sqlite/migrations/0006-outgoing-retry.sql" with { type: "text" };
import draftsSql from "../drafts/adapters/sqlite/migrations/0001-drafts.sql" with { type: "text" };
import draftsLogSql from "../drafts/adapters/sqlite/migrations/0002-log.sql" with { type: "text" };
import draftsApprovalsSql from "../drafts/adapters/sqlite/migrations/0003-approvals.sql" with { type: "text" };
import type { Settings } from "./settings";

/** Opens deputy.db and applies every slice's migrations. The list order is each file's user_version: append, never reorder. */
export async function openDatabase(settings: Settings): Promise<{ db: ReturnType<typeof openBunSqlite>; newer: boolean }> {
  await mkdir(settings.dataDir, { recursive: true });
  const dbPath = join(settings.dataDir, "deputy.db");
  const db = openBunSqlite({ path: dbPath });
  const migrated = await migrate(db, [
    { name: "0001-shared", sql: sharedSql },
    { name: "0001-owner-numbers", sql: ownerNumbersSql },
    { name: "0002-dev-holdings", sql: devHoldingsSql },
    { name: "0003-messages", sql: messagesSql },
    { name: "0004-outgoing", sql: outgoingSql },
    { name: "0005-catchup-status", sql: catchupStatusSql },
    { name: "0001-drafts", sql: draftsSql },
    { name: "0002-log", sql: draftsLogSql },
    { name: "0003-approvals", sql: draftsApprovalsSql },
    { name: "0006-outgoing-retry", sql: outgoingRetrySql },
  ], {
    basePath: dbPath,
    copyTo: (p) => copyFile(dbPath, p),
  });
  return { db, newer: migrated.kind === "newer_than_binary" };
}
