import type { SqlDatabase } from "../shared/sql-database";
import type { Clock } from "../shared/clock";
import type { LeaseControl } from "../shared/owner-lease";
import { InProcessEventBus } from "../adapters/events/in-process-event-bus";
import { DevDeliveries } from "../intake/adapters/dev/dev-deliveries";
import { devRoutes } from "../intake/adapters/http/dev-routes";
import { LiveListener } from "../intake/adapters/http/listener";
import { CatchUpScheduler } from "../intake/adapters/scheduler/catch-up-scheduler";
import { LibphonenumberParser } from "../intake/adapters/phone/libphonenumber-parser";
import { SqliteIntakeSettingsRepository } from "../intake/adapters/sqlite/sqlite-intake-settings-repository";
import { SqliteIntakeUnitOfWork } from "../intake/adapters/sqlite/sqlite-intake-unit-of-work";
import { createSqliteIntakeRepos } from "../intake/adapters/sqlite/sqlite-intake-repos";
import { SqliteOwnerNumbersRepository } from "../intake/adapters/sqlite/sqlite-owner-numbers-repository";
import { createIntakeRuntime, createOwnerNumberCommands, type IntakeEvent, type IntakeRuntime } from "../intake/index";
import type { ChosenProvider, Connection } from "./provider";

/** Owner-number commands and the repos they read. They run before the provider is chosen: a pending number is applied first. */
export function ownerNumberWiring(d: { db: SqlDatabase; lease: LeaseControl; clock: Clock }) {
  const owners = new SqliteOwnerNumbersRepository(d.db);
  const reads = createSqliteIntakeRepos(d.db);
  const ownerNumbers = createOwnerNumberCommands({
    repos: reads,
    owners,
    unitOfWork: new SqliteIntakeUnitOfWork(d.db, d.lease),
    parser: new LibphonenumberParser(),
    settings: new SqliteIntakeSettingsRepository(d.db),
    lease: d.lease,
    clock: d.clock,
  });
  return { owners, reads, ownerNumbers };
}

/** The Intake runtime, the catch-up scheduler and the listener, all built on the chosen provider. */
export function intakeWiring(d: {
  db: SqlDatabase;
  reads: ReturnType<typeof createSqliteIntakeRepos>;
  lease: LeaseControl;
  clock: Clock;
  port: number;
  chosen: Extract<ChosenProvider, { ok: true }>;
  receiving: "catch_up" | "live";
  connection: Connection;
}) {
  const events = new InProcessEventBus<IntakeEvent>();
  const intake: IntakeRuntime = createIntakeRuntime({
    repos: d.reads,
    unitOfWork: new SqliteIntakeUnitOfWork(d.db, d.lease),
    events,
    clock: d.clock,
    lease: d.lease,
    provider: d.chosen.provider,
    receiving: d.receiving,
    webhookSecret: d.connection.kapso.webhookSecret,
    settings: new SqliteIntakeSettingsRepository(d.db),
    devDeliveries: d.chosen.devProvider === null ? null : new DevDeliveries(d.chosen.devProvider),
  });
  const scheduler = new CatchUpScheduler({ catchUp: intake.catchUp, settings: intake.getIntakeSettings, clock: d.clock });
  const devProvider = d.chosen.devProvider;
  const listener = new LiveListener({
    receive: intake.receiveLiveDelivery,
    port: d.port,
    host: "127.0.0.1",
    devProvider: d.chosen.name === "dev",
    extraRoutes: devRoutes({
      provider: d.chosen.name,
      deliver: intake.deliverDevMessage,
      hold: devProvider === null ? null : async (q) => void (await devProvider.hold(q)),
      receive: intake.receiveLiveDelivery,
    }),
  });
  return { intake, scheduler, listener, listens: d.chosen.name === "dev" || d.receiving === "live" };
}
