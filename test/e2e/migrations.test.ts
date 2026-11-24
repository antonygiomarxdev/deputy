import { expect, test, setDefaultTimeout } from "bun:test";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { removeHarnessDirs, startServer, E2E_TIMEOUT_MS } from "../support/harness";

setDefaultTimeout(E2E_TIMEOUT_MS);

// One entry per migration file, in the global order of src/main.ts; a file's position is its user_version.
const TABLES_BY_MIGRATION = [
  ["lease", "settings", "pending_changes"],
  ["owner_numbers", "owner_number_log"],
  ["dev_holdings"],
  ["messages", "message_versions", "chats", "rejections", "rejection_pruned"],
  ["outgoing", "outgoing_parts", "source_changes"],
  ["catchup_status"],
  ["draft_counter", "drafts"],
  ["drafts_log"],
  ["approvals"],
  [], // 0006-outgoing-retry adds a column to outgoing
  [], // 0007-catchup-finished-at adds a column to catchup_status
];

test("booting migrates every slice, in order, and creates each table", async () => {
  const h = await startServer();
  try {
    await h.close();
    const db = new Database(join(h.dataDir, "deputy.db"), { readonly: true });
    const tables = new Set(
      db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => String((r as { name: unknown }).name)),
    );
    const version = db.query("PRAGMA user_version").get();
    db.close();
    for (const name of TABLES_BY_MIGRATION.flat()) expect(tables.has(name)).toBe(true);
    expect(version).toEqual({ user_version: TABLES_BY_MIGRATION.length });
  } finally {
    removeHarnessDirs(h);
  }
}, 15_000);
