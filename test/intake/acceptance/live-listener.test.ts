import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { LiveListener } from "../../../src/intake/adapters/http/listener";
import type { ReceiveLiveDelivery } from "../../../src/intake/ports/receive-live-delivery";
import { closedPort } from "../../support/fake-kapso-server";

const listeners: LiveListener[] = [];
afterEach(async () => {
  for (const l of listeners.splice(0)) await l.stop();
});

const JSON_HEADERS = { "content-type": "application/json" };

async function listen(receive: ReceiveLiveDelivery, o: { devProvider?: boolean; extraRoutes?: (req: Request) => Promise<Response | null> } = {}) {
  const port = await closedPort();
  const l = new LiveListener({ receive, port, host: "127.0.0.1", devProvider: o.devProvider ?? false, ...(o.extraRoutes === undefined ? {} : { extraRoutes: o.extraRoutes }) });
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
  const res = await fetch(`${base}/webhook`, { method: "POST", headers: JSON_HEADERS, body: "{}" });
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
    expect((await fetch(`${base}/webhook`, { method: "POST", headers: JSON_HEADERS, body: "{}" })).status).toBe(status);
  }
});

describe("a web page the owner visits must not reach the listener", () => {
  const calls = () => {
    const seen: string[] = [];
    const receive: ReceiveLiveDelivery = {
      execute: async () => {
        seen.push("receive");
        return { kind: "stored", stored: 1, duplicates: 0, ignored: 0 };
      },
    };
    const extraRoutes = async (req: Request) => {
      if (new URL(req.url).pathname.startsWith("/dev/")) {
        seen.push("dev");
        return new Response("dev ok");
      }
      return null;
    };
    return { seen, receive, extraRoutes };
  };
  const post = (base: string, path: string, headers: Record<string, string> = JSON_HEADERS) =>
    fetch(`${base}${path}`, { method: "POST", headers, body: "{}" });

  test("a request that carries an Origin header is a 403 on every route and reaches nothing", async () => {
    const { seen, receive, extraRoutes } = calls();
    const base = await listen(receive, { devProvider: true, extraRoutes });
    for (const origin of ["https://evil.example", "null"]) {
      const headers = { ...JSON_HEADERS, origin };
      expect((await post(base, "/webhook", headers)).status).toBe(403);
      expect((await post(base, "/dev/deliver", headers)).status).toBe(403);
      expect((await fetch(`${base}/health`, { headers: { origin } })).status).toBe(403);
    }
    expect(seen).toEqual([]);
    // the same request without an Origin goes through
    expect((await post(base, "/webhook")).status).toBe(200);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });

  test("a body that is not declared application/json is a 415 on every POST route", async () => {
    const { seen, receive, extraRoutes } = calls();
    const base = await listen(receive, { devProvider: true, extraRoutes });
    const variants: Record<string, string>[] = [{ "content-type": "text/plain" }, { "content-type": "application/x-www-form-urlencoded" }, {}];
    for (const headers of variants) {
      expect((await post(base, "/webhook", headers)).status).toBe(415);
      expect((await post(base, "/dev/deliver", headers)).status).toBe(415);
    }
    expect(seen).toEqual([]);
    expect((await post(base, "/webhook", { "content-type": "application/json; charset=utf-8" })).status).toBe(200);
    expect((await post(base, "/webhook", { "content-type": "Application/JSON" })).status).toBe(200);
  });

  test("with the dev provider, /dev and the webhook answer only the loopback host and the listener port", async () => {
    const { seen, receive, extraRoutes } = calls();
    const base = await listen(receive, { devProvider: true, extraRoutes });
    const port = new URL(base).port;
    for (const host of ["evil.example", `evil.example:${port}`, "localhost:1", `127.0.0.1:${Number(port) + 1}`, "127.0.0.1"]) {
      const headers = { ...JSON_HEADERS, host };
      expect((await post(base, "/webhook", headers)).status).toBe(403);
      expect((await post(base, "/dev/deliver", headers)).status).toBe(403);
    }
    expect(seen).toEqual([]);
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`]) {
      const headers = { ...JSON_HEADERS, host };
      expect((await post(base, "/webhook", headers)).status).toBe(200);
      expect((await post(base, "/dev/deliver", headers)).status).toBe(200);
    }
  });

  test("with Kapso the webhook takes any Host (a tunnel), but the /dev paths still refuse a foreign one", async () => {
    const { seen, receive, extraRoutes } = calls();
    const base = await listen(receive, { devProvider: false, extraRoutes });
    const headers = { ...JSON_HEADERS, host: "abc123.tunnel.example" };
    expect((await post(base, "/webhook", headers)).status).toBe(200);
    expect((await post(base, "/dev/deliver", headers)).status).toBe(403);
    expect(seen).toEqual(["receive"]);
  });
});
