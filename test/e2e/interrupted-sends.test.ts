import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import { removeHarnessDirs, startServer, waitForOwner, type Harness } from "../support/harness";

const open: Harness[] = [];
afterEach(async () => {
  for (const h of open.splice(0)) {
    await h.close().catch(() => 0);
    removeHarnessDirs(h);
  }
});

test("FR-INTAKE-04-6: at start, a send left pending by an earlier run becomes unknown before anything else runs", async () => {
  const first = await startServer();
  open.push(first);
  await waitForOwner(first);
  await first.close();

  const path = join(first.dataDir, "deputy.db");
  const db = new Database(path);
  db.run("INSERT INTO outgoing (send_id, chat_id, text, parts_total, state, created_at) VALUES ('s1', '+15557654321', 'Hello', 1, 'pending', 1)");
  db.run("INSERT INTO outgoing_parts (send_id, part, text, state) VALUES ('s1', 1, 'Hello', 'pending')");
  db.close();

  const second = await startServer({}, { dataDir: first.dataDir, configDir: first.configDir });
  open.push(second);
  await waitForOwner(second);
  expect(second.stderr()).toContain("1 interrupted send(s) are now unknown");
  await second.close();

  const check = new Database(path, { readonly: true });
  expect(check.query("SELECT state FROM outgoing WHERE send_id = 's1'").get()).toEqual({ state: "unknown" });
  expect(check.query("SELECT state FROM outgoing_parts WHERE send_id = 's1'").get()).toEqual({ state: "unknown" });
  check.close();
});
