import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { SystemClock } from "./adapters/clock/system-clock";
import { openBunSqlite } from "./adapters/sqlite/bun-sqlite-database";
import { migrate } from "./adapters/sqlite/migrate";
import { createSqliteOwnerLease } from "./adapters/sqlite/sqlite-owner-lease";
import { LeaseSupervisor } from "./adapters/supervisor/lease-supervisor";
import sharedSql from "./adapters/sqlite/migrations/0001-shared.sql" with { type: "text" };
import ownerNumbersSql from "./intake/adapters/sqlite/migrations/0001-owner-numbers.sql" with { type: "text" };
import devHoldingsSql from "./intake/adapters/sqlite/migrations/0002-dev-holdings.sql" with { type: "text" };
import messagesSql from "./intake/adapters/sqlite/migrations/0003-messages.sql" with { type: "text" };
import outgoingSql from "./intake/adapters/sqlite/migrations/0004-outgoing.sql" with { type: "text" };
import catchupStatusSql from "./intake/adapters/sqlite/migrations/0005-catchup-status.sql" with { type: "text" };
import draftsSql from "./drafts/adapters/sqlite/migrations/0001-drafts.sql" with { type: "text" };
import draftsLogSql from "./drafts/adapters/sqlite/migrations/0002-log.sql" with { type: "text" };
import { INSTRUCTIONS } from "./composition/mcp/instructions";
import { compositionTools } from "./composition/mcp/composition-tools";
import { createMcpServer } from "./composition/mcp/server";
import pkg from "../package.json" with { type: "json" };

async function serve(): Promise<number> {
  const dataDir = process.env["DEPUTY_DATA_DIR"] ?? "data";
  const configDir = process.env["DEPUTY_CONFIG_DIR"] ?? join(homedir(), ".deputy");
  await mkdir(dataDir, { recursive: true });

  const dbPath = join(dataDir, "deputy.db");
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
  ], {
    basePath: dbPath,
    copyTo: (p) => copyFile(dbPath, p),
  });
  if (migrated.kind === "newer_than_binary") {
    console.error("deputy: the database is newer than this program; update Deputy");
    db.close();
    return 1;
  }

  const clock = new SystemClock();
  const supervisor = new LeaseSupervisor({
    lease: createSqliteOwnerLease(db, clock, () => crypto.randomUUID()),
    clock,
    onAcquired: async () => console.error(`deputy: owner of ${dataDir} (config ${configDir})`),
    onLost: async () => console.error("deputy: lost the owner lease"),
  });

  const mcp = createMcpServer({
    name: "deputy",
    version: pkg.version,
    instructions: INSTRUCTIONS,
    tools: compositionTools({ isOwner: () => supervisor.isOwner, sections: [] }),
    claudeChannel: false,
  });

  let stopping: Promise<void> | null = null;
  const done = new Promise<void>((resolve) => {
    const shutdown = () => {
      stopping ??= supervisor.stop().finally(() => {
        db.close();
        resolve();
      });
    };
    process.stdin.once("end", shutdown);
    process.stdin.once("close", shutdown);
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });

  supervisor.start();
  await mcp.connectStdio();
  await done;
  return 0;
}

const command = process.argv[2];
if (command !== "serve") {
  console.error(`deputy: unknown command '${command ?? ""}'; only 'serve' is available`);
  process.exit(2);
}
process.exit(await serve());
