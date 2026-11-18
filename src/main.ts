import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { SystemClock } from "./adapters/clock/system-clock";
import { InProcessEventBus } from "./adapters/events/in-process-event-bus";
import { createSecretStore } from "./adapters/secrets/secret-store";
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
import draftsApprovalsSql from "./drafts/adapters/sqlite/migrations/0003-approvals.sql" with { type: "text" };
import { FileConnectionConfig } from "./intake/adapters/config/file-connection-config";
import { DevProvider } from "./intake/adapters/dev/dev-provider";
import { LiveListener } from "./intake/adapters/http/listener";
import { KapsoProvider } from "./intake/adapters/kapso/kapso-provider";
import { intakeTools } from "./intake/adapters/mcp/intake-tools";
import { LibphonenumberParser } from "./intake/adapters/phone/libphonenumber-parser";
import { SqliteIntakeUnitOfWork } from "./intake/adapters/sqlite/sqlite-intake-unit-of-work";
import { createSqliteIntakeRepos } from "./intake/adapters/sqlite/sqlite-intake-repos";
import { SqliteOwnerNumbersRepository } from "./intake/adapters/sqlite/sqlite-owner-numbers-repository";
import { createIntake, createIntakeRuntime, type IntakeEvent, type Provider } from "./intake/index";
import { IntakeChatReader } from "./drafts/adapters/intake/intake-chat-reader";
import { draftsTools } from "./drafts/adapters/mcp/drafts-tools";
import { UnavailableOrderPreparer } from "./drafts/adapters/orders/unavailable-order-preparer";
import { SqliteUnitOfWork } from "./drafts/adapters/sqlite/sqlite-unit-of-work";
import { createDrafts } from "./drafts/index";
import { listDraftsTool } from "./composition/mcp/list-drafts-tool";
import { INSTRUCTIONS } from "./composition/mcp/instructions";
import { compositionTools } from "./composition/mcp/composition-tools";
import { createMcpServer } from "./composition/mcp/server";
import pkg from "../package.json" with { type: "json" };

/** DEPUTY_PORT: a whole number from 1 to 65535, default 8788; anything else is refused, never turned into NaN. */
function parsePort(raw: string | undefined): number | null {
  if (raw === undefined) return 8788;
  const port = /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

async function serve(): Promise<number> {
  const port = parsePort(process.env["DEPUTY_PORT"]);
  if (port === null) {
    console.error(`deputy: DEPUTY_PORT must be a whole number from 1 to 65535, got '${process.env["DEPUTY_PORT"] ?? ""}'`);
    return 1;
  }
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
    { name: "0003-approvals", sql: draftsApprovalsSql },
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
  const lease = createSqliteOwnerLease(db, clock, () => crypto.randomUUID());

  const config = new FileConnectionConfig({
    configDir,
    secrets: createSecretStore({ os: { get: (service, name) => Bun.secrets.get({ service: process.env["DEPUTY_SECRET_SERVICE"] ?? service, name }) }, configDir }),
  });
  const owners = new SqliteOwnerNumbersRepository(db);
  const resolved = await createIntake({ config, owners }).resolveProviderSettings.execute();
  if (!resolved.ok) {
    console.error(`deputy: ${resolved.message}`);
    db.close();
    return 1;
  }
  for (const notice of resolved.notices) console.error(`deputy: ${notice}`);

  const connection = await config.read();
  let provider: Provider;
  if (resolved.provider === "dev") {
    provider = new DevProvider({ db, clock });
  } else {
    // ResolveProviderSettings has refused a missing key or phone number id already; this only narrows the types
    if (connection.kapso.apiKey === null || connection.kapso.phoneNumberId === null) {
      console.error("deputy: Kapso needs its api key and phone number id. Run Setup.");
      db.close();
      return 1;
    }
    provider = new KapsoProvider({
      baseUrl: process.env["DEPUTY_KAPSO_BASE_URL"] ?? "https://api.kapso.ai",
      graphVersion: "v24.0",
      apiKey: connection.kapso.apiKey,
      phoneNumberId: connection.kapso.phoneNumberId,
      clock,
      parser: new LibphonenumberParser(),
    });
  }

  const events = new InProcessEventBus<IntakeEvent>();
  const intake = createIntakeRuntime({
    repos: createSqliteIntakeRepos(db),
    unitOfWork: new SqliteIntakeUnitOfWork(db, lease),
    events,
    clock,
    lease,
    provider,
    receiving: resolved.receiving,
    webhookSecret: connection.kapso.webhookSecret?.reveal() ?? null,
  });

  const drafts = createDrafts({
    clock,
    lease,
    sessionStartedAt: clock.now(),
    unitOfWork: new SqliteUnitOfWork(db, lease),
    chats: new IntakeChatReader({ chatExists: intake.chatExists, readChat: intake.readChat }),
    orders: new UnavailableOrderPreparer(),
  });

  const listener = new LiveListener({
    receive: intake.receiveLiveDelivery,
    port,
    host: "127.0.0.1",
  });
  const listens = resolved.provider === "dev" || resolved.receiving === "live";

  const supervisor = new LeaseSupervisor({
    lease,
    clock,
    onAcquired: async () => {
      // first: a send cut off by a stop or a crash is unknown, before the scheduler or the listener can send or report anything
      const { marked } = await intake.markInterruptedSends.execute();
      if (marked > 0) console.error(`deputy: ${marked} interrupted send(s) are now unknown`);
      if (listens) await listener.start();
      console.error(`deputy: owner of ${dataDir} (config ${configDir}, provider ${resolved.provider})`);
    },
    onLost: async () => {
      await listener.stop();
      console.error("deputy: lost the owner lease");
    },
  });

  const mcp = createMcpServer({
    name: "deputy",
    version: pkg.version,
    instructions: INSTRUCTIONS,
    tools: [
      ...compositionTools({ isOwner: () => supervisor.isOwner, sections: [] }),
      ...intakeTools({ readChat: intake.readChat, listRejections: intake.listRejections }),
      ...draftsTools(drafts),
      // Knowledge is not wired yet: no catalog is known, so every check is "unknown"
      listDraftsTool({ listDrafts: drafts.listDrafts, catalogChangedSince: async (since) => since.map(() => "unknown" as const) }),
    ],
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
