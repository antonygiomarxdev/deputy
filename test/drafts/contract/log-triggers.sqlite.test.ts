import { afterEach, describe, expect, test } from "bun:test";
import { str } from "../../../src/adapters/sqlite/row";
import { closeLogDatabases, openLogDatabase } from "./log-database";

afterEach(closeLogDatabases);

const insert = (kind: string, draftKind: string | null, extra = "") =>
  `INSERT INTO drafts_log (at, kind, draft_number, draft_kind, chat, owner_words${extra ? ", " + extra.split("=")[0] : ""}) VALUES ('2026-01-01T00:00:00.000Z', '${kind}', 1, ${draftKind === null ? "NULL" : `'${draftKind}'`}, 'c', 'go 1'${extra ? ", " + extra.split("=")[1] : ""})`;

describe("FR-DRAFTS-04-7: drafts_log is append-only", () => {
  test("every DELETE aborts", async () => {
    const db = await openLogDatabase();
    await db.run(insert("proposed", "reply"));
    await expect(db.run("DELETE FROM drafts_log")).rejects.toThrow("append-only");
  });

  // covers: drafts/FRD-04/EX-13
  test("an UPDATE of a reply entry aborts, scrub flag included", async () => {
    const db = await openLogDatabase();
    await db.run(insert("proposed", "reply"));
    await expect(db.run("UPDATE drafts_log SET scrubbed = 1")).rejects.toThrow("append-only");
    await expect(db.run("UPDATE drafts_log SET reason = 'x'")).rejects.toThrow("append-only");
  });

  test("the scrub update of an order entry passes; any other column change aborts", async () => {
    const db = await openLogDatabase();
    await db.run(insert("proposed", "order"));
    await expect(db.run("UPDATE drafts_log SET scrubbed = 1, reason = 'x'")).rejects.toThrow("append-only");
    await expect(db.run("UPDATE drafts_log SET scrubbed = 1, owner_words = 'other'")).rejects.toThrow("append-only");
    await db.run("UPDATE drafts_log SET scrubbed = 1, owner_words = 'deleted'");
    await expect(db.run("UPDATE drafts_log SET scrubbed = 0")).rejects.toThrow("append-only");
  });

  test("an entry with no draft kind is never scrubbable (a NULL must not pass the trigger)", async () => {
    const db = await openLogDatabase();
    await db.run(insert("rejected", null));
    await expect(db.run("UPDATE drafts_log SET scrubbed = 1, owner_words = 'deleted'")).rejects.toThrow("append-only");
  });

  test("schema: the trigger lists every column of the table", async () => {
    const db = await openLogDatabase();
    const columns = (await db.query("PRAGMA table_info(drafts_log)")).map((r) => str(r, "name"));
    const [trigger] = await db.query("SELECT sql FROM sqlite_master WHERE name = 'drafts_log_scrub_only'");
    const text = str(trigger ?? {}, "sql");
    for (const c of columns.filter((c) => c !== "scrubbed" && c !== "owner_words")) {
      expect(text).toContain(`NEW.${c} IS OLD.${c}`);
    }
  });
});

describe("FR-DRAFTS-04-9: the schema CHECKs", () => {
  test("an order draft entry with a proposed or final text is refused", async () => {
    const db = await openLogDatabase();
    await expect(db.run(insert("proposed", "order", "proposed_text='x'"))).rejects.toThrow();
    await expect(db.run(insert("proposed", "order", "final_text='x'"))).rejects.toThrow();
  });

  test("an entry with neither a draft number nor an order reference is refused", async () => {
    const db = await openLogDatabase();
    await expect(
      db.run("INSERT INTO drafts_log (at, kind, chat) VALUES ('2026-01-01T00:00:00.000Z', 'proposed', 'c')"),
    ).rejects.toThrow();
  });
});
