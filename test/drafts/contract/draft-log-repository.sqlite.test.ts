import { afterEach } from "bun:test";
import { SqliteDraftLogRepository } from "../../../src/drafts/adapters/sqlite/sqlite-draft-log-repository";
import type { DraftLogRepository } from "../../../src/drafts/ports/log";
import type { NewLogEntry } from "../../../src/drafts/domain/log-entry";
import { draftLogRepositoryContract } from "./draft-log-repository.contract";
import { closeLogDatabases, openLogDatabase } from "./log-database";

afterEach(closeLogDatabases);

// The contract's factory is synchronous, so the database opens on the first call.
draftLogRepositoryContract("SQLite", (): DraftLogRepository => {
  const ready = openLogDatabase().then((db) => new SqliteDraftLogRepository(db));
  return {
    append: async (e: NewLogEntry[]) => (await ready).append(e),
    page: async (f) => (await ready).page(f),
    sentWithApproval: async () => (await ready).sentWithApproval(),
    stuckDrafts: async () => (await ready).stuckDrafts(),
    scrubOrder: async (o, d) => (await ready).scrubOrder(o, d),
    approvalEntryIdFor: async (s) => (await ready).approvalEntryIdFor(s),
    hasOrderDeleted: async (o) => (await ready).hasOrderDeleted(o),
  };
});
