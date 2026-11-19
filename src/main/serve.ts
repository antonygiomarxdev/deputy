import { SystemClock } from "../adapters/clock/system-clock";
import { createSqliteOwnerLease } from "../adapters/sqlite/sqlite-owner-lease";
import { createIntake } from "../intake/index";
import { openDatabase } from "./database";
import { chooseProvider } from "./provider";
import { intakeWiring, ownerNumberWiring } from "./intake";
import { draftsWiring } from "./drafts";
import { superviseLease, untilShutdown } from "./lifecycle";
import { mcpServer } from "./tools";
import { connectionConfig, readSettings } from "./settings";

/** The start sequence, top to bottom. A refusal logs one line, releases the lease if it is held, closes the database and returns 1. */
export async function serve(): Promise<number> {
  const read = readSettings();
  if (!read.ok) {
    console.error(`deputy: ${read.message}`);
    return 1;
  }
  const settings = read.settings;

  const { db, newer } = await openDatabase(settings);
  if (newer) {
    console.error("deputy: the database is newer than this program; update Deputy");
    db.close();
    return 1;
  }

  const clock = new SystemClock();
  const lease = createSqliteOwnerLease(db, clock, () => crypto.randomUUID());
  const config = connectionConfig(settings.configDir);
  const { owners, reads, ownerNumbers } = ownerNumberWiring({ db, lease, clock });
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
  const chosen = chooseProvider(resolved.provider, connection, db, clock);
  if (!chosen.ok) {
    console.error(`deputy: ${chosen.message}`);
    await lease.release();
    db.close();
    return 1;
  }

  const wired = intakeWiring({ db, reads, lease, clock, port: settings.port, chosen, receiving: resolved.receiving, connection });
  const { drafts, approvals } = draftsWiring({ db, lease, clock, intake: wired.intake });
  const supervisor = superviseLease({
    lease,
    clock,
    settings,
    providerName: resolved.provider,
    intake: wired.intake,
    scheduler: wired.scheduler,
    listener: wired.listener,
    listens: wired.listens,
    ownerNumbers,
    approvals,
  });
  const mcp = mcpServer({ supervisor, intake: wired.intake, ownerNumbers, drafts, approvals });
  const done = untilShutdown(supervisor, db);

  supervisor.start();
  await mcp.connectStdio();
  await done;
  return 0;
}
