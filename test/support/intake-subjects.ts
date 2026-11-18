import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBunSqlite } from "../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../src/adapters/sqlite/migrate";
import { InMemoryIntakeStore } from "../../src/intake/adapters/memory/in-memory-intake-store";
import { createSqliteIntakeRepos } from "../../src/intake/adapters/sqlite/sqlite-intake-repos";
import { createSqliteIntakeUnitOfWork } from "../../src/intake/adapters/sqlite/sqlite-intake-unit-of-work";
import type { IntakeRepos, IntakeUnitOfWork } from "../../src/intake/ports/intake-unit-of-work";
import type { OwnerLease } from "../../src/shared/owner-lease";
import type { ProviderName } from "../../src/shared/provider-name";
import type { SendId } from "../../src/shared/send-id";

export interface IntakeSubject {
  name: string;
  repos: IntakeRepos;
  unitOfWork: IntakeUnitOfWork;
  addOutgoingPart(provider: ProviderName, providerMessageId: string, sendId: SendId, part: number): Promise<void>;
  cleanup(): void;
}

const MIGRATIONS = [
  "adapters/sqlite/migrations/0001-shared.sql",
  "intake/adapters/sqlite/migrations/0001-owner-numbers.sql",
  "intake/adapters/sqlite/migrations/0003-messages.sql",
  "intake/adapters/sqlite/migrations/0004-outgoing.sql",
  "intake/adapters/sqlite/migrations/0005-catchup-status.sql",
];

export const ownsLease: OwnerLease = { isOwner: async () => true };

export async function openSqliteSubject(lease: OwnerLease = ownsLease): Promise<IntakeSubject & { db: ReturnType<typeof openBunSqlite> }> {
  const dir = mkdtempSync(join(tmpdir(), "deputy-intake-"));
  const path = join(dir, "deputy.db");
  const db = openBunSqlite({ path });
  const files = await Promise.all(
    MIGRATIONS.map(async (rel) => ({ name: rel, sql: await Bun.file(join(import.meta.dir, "../../src", rel)).text() })),
  );
  await migrate(db, files, { basePath: path, copyTo: async (p) => copyFileSync(path, p) });
  return {
    name: "sqlite",
    db,
    repos: createSqliteIntakeRepos(db),
    unitOfWork: createSqliteIntakeUnitOfWork(db, lease),
    async addOutgoingPart(provider, providerMessageId, sendId, part) {
      await db.run("INSERT INTO outgoing (send_id, chat_id, text, parts_total, state, created_at) VALUES (?, 'c', 't', 1, 'sent', 1)", [sendId]);
      await db.run(
        "INSERT INTO outgoing_parts (send_id, part, text, provider, provider_message_id, state) VALUES (?, ?, 't', ?, ?, 'sent')",
        [sendId, part, provider, providerMessageId],
      );
    },
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function openMemorySubject(): IntakeSubject {
  const store = new InMemoryIntakeStore();
  return {
    name: "in-memory",
    repos: store.repos,
    unitOfWork: store.unitOfWork,
    async addOutgoingPart(provider, providerMessageId, sendId, part) {
      store.addOutgoingPart(provider, providerMessageId, sendId, part);
    },
    cleanup() {},
  };
}

export const subjects: ReadonlyArray<{ name: string; open: () => Promise<IntakeSubject> }> = [
  { name: "in-memory", open: async () => openMemorySubject() },
  { name: "sqlite", open: () => openSqliteSubject() },
];
