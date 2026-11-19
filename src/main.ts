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
import outgoingRetrySql from "./intake/adapters/sqlite/migrations/0006-outgoing-retry.sql" with { type: "text" };
import draftsApprovalsSql from "./drafts/adapters/sqlite/migrations/0003-approvals.sql" with { type: "text" };
import { FileConnectionConfig } from "./intake/adapters/config/file-connection-config";
import { DevDeliveries } from "./intake/adapters/dev/dev-deliveries";
import { DevProvider } from "./intake/adapters/dev/dev-provider";
import { devRoutes } from "./intake/adapters/http/dev-routes";
import { LiveListener } from "./intake/adapters/http/listener";
import { KapsoProvider } from "./intake/adapters/kapso/kapso-provider";
import { formatSyncStatus, intakeTools } from "./intake/adapters/mcp/intake-tools";
import { CatchUpScheduler } from "./intake/adapters/scheduler/catch-up-scheduler";
import { SqliteIntakeSettingsRepository } from "./intake/adapters/sqlite/sqlite-intake-settings-repository";
import { LibphonenumberParser } from "./intake/adapters/phone/libphonenumber-parser";
import { SqliteIntakeUnitOfWork } from "./intake/adapters/sqlite/sqlite-intake-unit-of-work";
import { createSqliteIntakeRepos } from "./intake/adapters/sqlite/sqlite-intake-repos";
import { SqliteOwnerNumbersRepository } from "./intake/adapters/sqlite/sqlite-owner-numbers-repository";
import { createIntake, createIntakeRuntime, createOwnerNumberCommands, type IntakeEvent, type Provider } from "./intake/index";
import { IntakeChatReader } from "./drafts/adapters/intake/intake-chat-reader";
import { Sha256Digest } from "./drafts/adapters/crypto/sha256-digest";
import { UuidIds } from "./drafts/adapters/crypto/uuid-ids";
import { IntakeCustomerTextCheck } from "./drafts/adapters/intake/intake-customer-text-check";
import { IntakeSender } from "./drafts/adapters/intake/intake-sender";
import { approvalTools, draftsTools, logTools } from "./drafts/adapters/mcp/drafts-tools";
import { UnavailableOrderChanger } from "./drafts/adapters/orders/unavailable-order-changer";
import { UnavailableOrderPreparer } from "./drafts/adapters/orders/unavailable-order-preparer";
import { UnavailableOrderRecorder } from "./drafts/adapters/orders/unavailable-order-recorder";
import { SqliteUnitOfWork } from "./drafts/adapters/sqlite/sqlite-unit-of-work";
import { createApprovals, createDrafts } from "./drafts/index";
import { listDraftsTool } from "./composition/mcp/list-drafts-tool";
import { INSTRUCTIONS } from "./composition/mcp/instructions";
import { compositionTools } from "./composition/mcp/composition-tools";
import { ownerHooks } from "./composition/owner-hooks";
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
    { name: "0006-outgoing-retry", sql: outgoingRetrySql },
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
  const reads = createSqliteIntakeRepos(db);
  const ownerNumbers = createOwnerNumberCommands({
    repos: reads,
    owners,
    unitOfWork: new SqliteIntakeUnitOfWork(db, lease),
    parser: new LibphonenumberParser(),
    settings: new SqliteIntakeSettingsRepository(db),
    lease,
    clock,
  });
  // a pending business number must be applied before ResolveProviderSettings looks for one; only the owner may apply it
  if (await lease.tryAcquire()) await ownerNumbers.applyPendingChanges.execute();
  const resolved = await createIntake({ config, owners }).resolveProviderSettings.execute();
  if (!resolved.ok) {
    console.error(`deputy: ${resolved.message}`);
    await lease.release();
    db.close();
    return 1;
  }
  for (const notice of resolved.notices) console.error(`deputy: ${notice}`);

  const connection = await config.read();
  let provider: Provider;
  let devProvider: DevProvider | null = null;
  if (resolved.provider === "dev") {
    devProvider = new DevProvider({ db, clock });
    provider = devProvider;
  } else {
    // ResolveProviderSettings has refused a missing key or phone number id already; this only narrows the types
    if (connection.kapso.apiKey === null || connection.kapso.phoneNumberId === null) {
      console.error("deputy: Kapso needs its api key and phone number id. Run Setup.");
      await lease.release();
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
    repos: reads,
    unitOfWork: new SqliteIntakeUnitOfWork(db, lease),
    events,
    clock,
    lease,
    provider,
    receiving: resolved.receiving,
    webhookSecret: connection.kapso.webhookSecret,
    settings: new SqliteIntakeSettingsRepository(db),
    devDeliveries: devProvider === null ? null : new DevDeliveries(devProvider),
  });
  const scheduler = new CatchUpScheduler({ catchUp: intake.catchUp, settings: intake.getIntakeSettings, clock });

  const draftsUnitOfWork = new SqliteUnitOfWork(db, lease);
  const drafts = createDrafts({
    clock,
    lease,
    sessionStartedAt: clock.now(),
    unitOfWork: draftsUnitOfWork,
    chats: new IntakeChatReader({ chatExists: intake.chatExists, readChat: intake.readChat }),
    orders: new UnavailableOrderPreparer(),
  });
  const approvals = createApprovals({
    clock,
    lease,
    unitOfWork: draftsUnitOfWork,
    customerText: new IntakeCustomerTextCheck({ isCustomerText: intake.isCustomerText }),
    sender: new IntakeSender({ sendText: intake.sendText }),
    orderRecorder: new UnavailableOrderRecorder(),
    orderChanger: new UnavailableOrderChanger(),
    digest: new Sha256Digest(),
    ids: new UuidIds(),
  });

  const listener = new LiveListener({
    receive: intake.receiveLiveDelivery,
    port,
    host: "127.0.0.1",
    devProvider: resolved.provider === "dev",
    extraRoutes: devRoutes({
      provider: resolved.provider,
      deliver: intake.deliverDevMessage,
      hold: devProvider === null ? null : async (q) => void (await devProvider.hold(q)),
      receive: intake.receiveLiveDelivery,
    }),
  });
  const listens = resolved.provider === "dev" || resolved.receiving === "live";

  const hooks = ownerHooks({
    markInterruptedSends: () => intake.markInterruptedSends.execute(),
    listener,
    listens,
    scheduler,
    ownerLine: `deputy: owner of ${dataDir} (config ${configDir}, provider ${resolved.provider})`,
    log: (line) => console.error(line),
  });
  const supervisor = new LeaseSupervisor({
    lease,
    clock,
    onAcquired: hooks.onAcquired,
    onLost: hooks.onLost,
    // every tick while this process owns the data: owner-number changes the terminal left pending, and `sent` records
    // that could not be written (retried here, never by sending again)
    onTick: async () => {
      try {
        await ownerNumbers.applyPendingChanges.execute();
      } finally {
        await approvals.retryPendingOutcomes.run();
      }
    },
  });

  const mcp = createMcpServer({
    name: "deputy",
    version: pkg.version,
    instructions: INSTRUCTIONS,
    tools: [
      ...compositionTools({
        isOwner: () => supervisor.isOwner,
        sections: [async () => formatSyncStatus(await intake.getSyncStatus.execute())],
      }),
      ...intakeTools({
        readChat: intake.readChat,
        listRejections: intake.listRejections,
        catchUp: intake.catchUp,
        getOwnerNumbers: ownerNumbers.getOwnerNumbers,
      }),
      ...draftsTools(drafts),
      ...logTools(drafts),
      // Orders is not wired yet, so change_order and delete_order would only ever refuse: only the go that sends is offered
      ...approvalTools(approvals).filter((t) => t.name === "approve_draft"),
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
