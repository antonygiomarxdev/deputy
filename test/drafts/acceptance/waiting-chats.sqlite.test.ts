import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";
import { SqliteUnitOfWork } from "../../../src/drafts/adapters/sqlite/sqlite-unit-of-work";
import { WaitingChatsUseCase } from "../../../src/drafts/application/waiting-chats";
import { Draft } from "../../../src/drafts/domain/draft";
import type { ChatId } from "../../../src/shared/chat-id";
import { FakeClock } from "../../support/fake-clock";
import { InMemoryOwnerLease } from "../../support/in-memory-owner-lease";

const root = join(import.meta.dir, "..", "..", "..");
const sql = (p: string) => readFileSync(join(root, p), "utf8");

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

test("FR-DRAFTS-01-4: WaitingChats reads while another connection holds the write lock", async () => {
  const dir = mkdtempSync(join(tmpdir(), "deputy-waiting-"));
  const path = join(dir, "deputy.db");
  // a short busy timeout: a write transaction would fail at once instead of waiting
  const reader = openBunSqlite({ path, busyTimeoutMs: 50 });
  const writer = openBunSqlite({ path, busyTimeoutMs: 50 });
  cleanups.push(() => {
    reader.close();
    writer.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await migrate(
    reader,
    [
      { name: "0001-shared", sql: sql("src/adapters/sqlite/migrations/0001-shared.sql") },
      { name: "0001-drafts", sql: sql("src/drafts/adapters/sqlite/migrations/0001-drafts.sql") },
      { name: "0002-log", sql: sql("src/drafts/adapters/sqlite/migrations/0002-log.sql") },
    ],
    { basePath: path, copyTo: async () => {} },
  );
  const lease = new InMemoryOwnerLease({ token: "me", heartbeat: 1 }, new FakeClock(1), "me");
  const uow = new SqliteUnitOfWork(reader, lease);
  const made = Draft.propose({
    number: 1, kind: "reply", chat: "chat-a" as ChatId, text: "hello", now: 1_000, dev: false, answers: null,
    basis: { messageId: { provider: "dev", providerMessageId: "m1" }, sentAt: 900 }, checkedStoredAt: 950, orderPayload: null,
  });
  if (!("draft" in made)) throw new Error("fixture refused");
  await uow.run(async (tx) => {
    await tx.drafts.nextNumber();
    await tx.drafts.save(made.draft);
  });

  await writer.run("BEGIN IMMEDIATE"); // the write lock of another process
  const waiting = await new WaitingChatsUseCase({ unitOfWork: uow, sessionStartedAt: 0 }).run();
  expect(waiting.map((w) => w.chat)).toEqual(["chat-a"]);
  await writer.run("ROLLBACK");
});
