import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import { call, removeHarnessDirs, startServer, waitForOwner, type Harness } from "../support/harness";
import { postDelivery, url } from "../support/live";

const open: Harness[] = [];
afterEach(async () => {
  const errors: Error[] = [];
  for (const h of open.splice(0)) {
    errors.push(...h.protocolErrors);
    await h.close().catch(() => 0);
    removeHarnessDirs(h);
  }
  expect(errors).toEqual([]);
});

const textOf = (r: Awaited<ReturnType<typeof call>>): string => {
  const first = Array.isArray(r.content) ? r.content[0] : undefined;
  return first !== undefined && first.type === "text" ? first.text : "";
};

/** What a second process does when it takes the lease: it writes its own token with a fresh heartbeat. */
function takeLeaseAsAnotherProcess(h: Harness): void {
  const db = new Database(join(h.dataDir, "deputy.db"));
  try {
    const now = Date.now();
    const taken = db.run("UPDATE lease SET token = 'another-process', holder_started = ?, heartbeat = ? WHERE id = 1", [now, now]);
    expect(taken.changes).toBe(1);
  } finally {
    db.close();
  }
}

test("a second process takes the lease: the first stops its listener and its work, says so, and reports read-only", async () => {
  const h = await startServer();
  open.push(h);
  await waitForOwner(h);
  expect((await fetch(url(h, "/health"))).status).toBe(200);
  expect(textOf(await call(h.client, "status")).split("\n")[0]).toBe("mode: owner");

  takeLeaseAsAnotherProcess(h);

  // the supervisor notices at its next tick (every 10 s); the loss hook then runs
  const until = Date.now() + 15_000;
  while (!h.stderr().includes("deputy: lost the owner lease") && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  expect(h.stderr()).toContain("deputy: lost the owner lease");

  // the listener is closed: nothing answers on the port, and a delivery cannot be stored
  await expect(fetch(url(h, "/health"))).rejects.toThrow();
  await expect(postDelivery(h, { chat: "15557654321", from: "15557654321", text: "late", providerMessageId: "late-1" })).rejects.toThrow();

  // the process says it is not the owner, and writes nothing on request
  expect(textOf(await call(h.client, "status")).split("\n")[0]).toBe("mode: read-only");
  const asked = await call(h.client, "check_messages");
  expect(asked.isError).toBe(true);
  expect(textOf(asked)).toBe("not_owner");
}, 25_000);
