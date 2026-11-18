import { afterEach, expect, test } from "bun:test";
import { SqliteDraftLogRepository } from "../../../src/drafts/adapters/sqlite/sqlite-draft-log-repository";
import type { DraftLogRepository } from "../../../src/drafts/ports/log";
import type { ChatId } from "../../../src/shared/chat-id";
import type { NewLogEntry } from "../../../src/drafts/domain/log-entry";
import { draftLogRepositoryContract } from "./draft-log-repository.contract";
import { closeLogDatabases, openLogDatabase } from "./log-database";

afterEach(closeLogDatabases);

// The contract's factory is synchronous, so the database opens on the first call.
const base = {
  draftKind: "reply" as const, chat: "c" as ChatId, proposedText: null, finalText: null, reason: null,
  ownerWords: null, approvalEntryId: null, sendId: null, orderRef: null,
};

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

test("stuckDrafts lists reply drafts in sending or unknown with no sent entry, since the latest sending entry", async () => {
  const db = await openLogDatabase();
  const log = new SqliteDraftLogRepository(db);
  await db.run("UPDATE drafts SET state = 'sending' WHERE number IN (1, 3)");
  await db.run("UPDATE drafts SET state = 'unknown' WHERE number = 2");
  await log.append([
    { ...base, kind: "sending", draft: 1, at: 100 },
    { ...base, kind: "sending", draft: 1, at: 300 },
    { ...base, kind: "sending", draft: 3, at: 200 },
    { ...base, kind: "sent", draft: 3, at: 250 },
  ]);
  const stuck = await log.stuckDrafts();
  expect(stuck.map((s) => [s.draft, s.state])).toEqual([[1, "sending"], [2, "unknown"]]);
  expect(stuck[0]?.since).toBe(new Date(300).toISOString());
});
