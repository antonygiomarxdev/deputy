import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { removeHarnessDirs, startServer } from "../support/harness";

test("boots over stdio, serves instructions and tools, and exits fast on stdin close", async () => {
  const h = await startServer();
  try {
    const instructions = h.client.getInstructions();
    expect(instructions).toContain("approve_draft");
    expect((await h.client.listTools()).tools.map((t) => t.name)).toEqual([
      "status",
      "get_chat",
      "rejected_deliveries",
      "list_owner_numbers",
      "check_messages",
      "create_draft",
      "change_draft",
      "reject_draft",
      "drafts_log",
      "check_approvals",
      "approve_draft",
      "list_drafts",
    ]);
    expect(h.protocolErrors).toEqual([]);

    const ms = await h.close();
    expect(ms).toBeLessThan(400);

    const db = new Database(join(h.dataDir, "deputy.db"), { readonly: true });
    const row = db.query("SELECT heartbeat FROM lease WHERE id = 1").get();
    db.close();
    expect(row).toEqual({ heartbeat: 0 });
  } finally {
    removeHarnessDirs(h);
  }
}, 15_000);
