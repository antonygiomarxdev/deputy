import { afterEach, expect, spyOn, test } from "bun:test";
import { LiveListener } from "../../../src/intake/adapters/http/listener";
import type { ReceiveLiveDelivery } from "../../../src/intake/ports/receive-live-delivery";
import { closedPort } from "../../support/fake-kapso-server";

const listeners: LiveListener[] = [];
afterEach(async () => {
  for (const l of listeners.splice(0)) await l.stop();
});

async function listen(receive: ReceiveLiveDelivery) {
  const port = await closedPort();
  const l = new LiveListener({ receive, port, host: "127.0.0.1" });
  listeners.push(l);
  await l.start();
  return `http://127.0.0.1:${port}`;
}

test("a use case that throws answers 500 and logs only the error name", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  const base = await listen({
    execute: async () => {
      throw new TypeError("customer said: secret words");
    },
  });
  const res = await fetch(`${base}/webhook`, { method: "POST", body: "{}" });
  expect(res.status).toBe(500);
  const logged = log.mock.calls.map((c) => String(c[0])).join("\n");
  log.mockRestore();
  expect(logged).toContain("TypeError");
  expect(logged).not.toContain("secret words");
});

test("the result kinds map to their status codes", async () => {
  const cases = [
    [{ kind: "stored", stored: 1, duplicates: 0, ignored: 0 }, 200],
    [{ kind: "rejected", reason: "bad_signature" }, 401],
    [{ kind: "rejected", reason: "malformed" }, 400],
    [{ kind: "storage_failed" }, 500],
    [{ kind: "live_off" }, 404],
    [{ kind: "refused", reason: "not_owner" }, 503],
  ] as const;
  for (const [result, status] of cases) {
    const base = await listen({ execute: async () => result });
    expect((await fetch(`${base}/webhook`, { method: "POST", body: "{}" })).status).toBe(status);
  }
});
