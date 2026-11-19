import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { MAX_PART } from "../../../src/intake/domain/constants";
import { OutgoingSend } from "../../../src/intake/domain/outgoing-send";
import { SyncState } from "../../../src/intake/domain/sync-state";
import { parseChatId, type ChatId } from "../../../src/shared/chat-id";
import { parseSendId } from "../../../src/shared/send-id";
import { receive } from "../../support/intake-fixtures";
import { openSqliteSubject } from "../../support/intake-subjects";
import type { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";

const chat = (s: string): ChatId => {
  const c = parseChatId(s);
  if (!c) throw new Error(s);
  return c;
};

// Corrupt rows are written past the CHECK constraints, the way a bad migration or a hand edit would leave them.
async function corrupt(db: ReturnType<typeof openBunSqlite>, sql: string): Promise<void> {
  await db.run("PRAGMA ignore_check_constraints = ON");
  await db.run(sql);
}

describe("SQLite row decoders reject a corrupt row", () => {
  let s: Awaited<ReturnType<typeof openSqliteSubject>>;
  beforeEach(async () => {
    s = await openSqliteSubject();
  });
  afterEach(() => s.cleanup());

  test("providerOf: a message row with an unknown provider", async () => {
    await s.repos.messages.insertIfNew(receive({ providerMessageId: "m1" }));
    await corrupt(s.db, "UPDATE messages SET provider = 'x' WHERE provider_message_id = 'm1'");
    // listChat has no provider filter, so the row is decoded; a find by provider would miss it.
    await expect(s.repos.messages.listChat(chat("+541123456789"), {})).rejects.toThrow("provider 'x'");
  });

  test("sourceOf: a message row with an unknown source", async () => {
    await s.repos.messages.insertIfNew(receive({ providerMessageId: "m1" }));
    await corrupt(s.db, "UPDATE messages SET source = 'bogus' WHERE provider_message_id = 'm1'");
    await expect(s.repos.messages.find({ provider: "kapso", providerMessageId: "m1" })).rejects.toThrow("source 'bogus'");
  });

  test("markFromRow: a message row with an unknown mark", async () => {
    await s.repos.messages.insertIfNew(receive({ providerMessageId: "m1" }));
    await corrupt(s.db, "UPDATE messages SET mark = 'bogus' WHERE provider_message_id = 'm1'");
    await expect(s.repos.messages.find({ provider: "kapso", providerMessageId: "m1" })).rejects.toThrow("mark 'bogus'");
  });

  test("stateOf: an outgoing send with an unknown state", async () => {
    const id = parseSendId("s1");
    if (id === null) throw new Error("s1");
    await s.repos.outgoing.insert(OutgoingSend.create({ sendId: id, chat: chat("+541123456789"), text: "a".repeat(MAX_PART + 5), createdAt: 100 }));
    await corrupt(s.db, "UPDATE outgoing SET state = 'bogus' WHERE send_id = 's1'");
    await expect(s.repos.outgoing.find(id)).rejects.toThrow("send state 'bogus'");
  });

  test("reasonOf: a sync state with a reason that is not stored", async () => {
    const state = SyncState.initial("kapso");
    state.begin({ providerTime: 1_000, now: 2_000 });
    state.fail("possible_gap", 4_000);
    await s.repos.syncState.save(state);
    await corrupt(s.db, "UPDATE catchup_status SET reason = 'not_yet_run' WHERE provider = 'kapso'");
    await expect(s.repos.syncState.load("kapso")).rejects.toThrow();
  });
});
