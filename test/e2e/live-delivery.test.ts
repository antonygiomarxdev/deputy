import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_BODY_BYTES } from "../../src/intake/adapters/http/listener";
import { startFakeKapso } from "../support/fake-kapso-server";
import { call, removeHarnessDirs, startServer, waitForOwner, writeConfig, type Harness } from "../support/harness";
import { postDelivery, url } from "../support/live";

const CHAT = "+15557654321";
let seq = 0;
// a dev delivery carries the id the dev adapter gave it when it held the message (SPEC-01 Task 12)
const body = (text: string) => ({ chat: "15557654321", from: "15557654321", text, providerMessageId: `dev-in-${++seq}` });

const started: Harness[] = [];
const fakes: { stop(): void }[] = [];

async function boot(...args: Parameters<typeof startServer>): Promise<Harness> {
  const h = await startServer(...args);
  started.push(h);
  await waitForOwner(h);
  return h;
}

afterEach(async () => {
  for (const f of fakes.splice(0)) f.stop();
  const errors: Error[] = [];
  for (const h of started.splice(0)) {
    errors.push(...h.protocolErrors);
    await h.close().catch(() => 0);
    removeHarnessDirs(h);
  }
  // stdout is the MCP transport: anything else the server prints shows up here
  expect(errors).toEqual([]);
});

const textOf = (r: Awaited<ReturnType<typeof call>>): string => {
  const first = Array.isArray(r.content) ? r.content[0] : undefined;
  return first !== undefined && first.type === "text" ? first.text : "";
};

test("FR-INTAKE-02-1 and FR-INTAKE-01-2: a delivery signed with the dev secret is stored and get_chat returns it", async () => {
  const h = await boot();
  const res = await postDelivery(h, body("How much is the cake?"));
  expect(res.status).toBe(200);
  const chat = await call(h.client, "get_chat", { chat: CHAT });
  expect(chat.isError).toBeFalsy();
  expect(textOf(chat)).toContain("<customer_text>How much is the cake?</customer_text>");
  expect(await (await fetch(url(h, "/health"))).text()).toBe("ok");
});

test("FR-INTAKE-02-2 and 02-3: a bad and a missing signature are 401, store nothing and are listed without content", async () => {
  const h = await boot();
  expect((await postDelivery(h, body("secret words"), "sha256=00")).status).toBe(401);
  expect((await postDelivery(h, body("secret words"), "none")).status).toBe(401);
  expect((await call(h.client, "get_chat", { chat: CHAT })).isError).toBe(true);
  const list = textOf(await call(h.client, "rejected_deliveries"));
  expect(list).toContain("bad_signature");
  expect(list).toContain("missing_signature");
  expect(list).not.toContain("secret words");
});

test("a body above MAX_BODY_BYTES is 413 and nothing is stored", async () => {
  const h = await boot();
  const res = await postDelivery(h, new Uint8Array(MAX_BODY_BYTES + 1));
  expect(res.status).toBe(413);
  expect((await call(h.client, "get_chat", { chat: CHAT })).isError).toBe(true);
});

test("a streamed body with no Content-Length is counted and refused above the limit", async () => {
  const h = await boot();
  const chunk = new Uint8Array(64 * 1024);
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent > MAX_BODY_BYTES) controller.close();
      else controller.enqueue(chunk);
      sent += chunk.byteLength;
    },
  });
  const res = await fetch(url(h, "/webhook"), { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
  expect(res.status).toBe(413);
});

test("a storage failure is 500", async () => {
  const h = await boot();
  const other = new Database(join(h.dataDir, "deputy.db"));
  other.run("CREATE TRIGGER fail_inserts BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'disk full'); END");
  other.close();
  expect((await postDelivery(h, body("hello"))).status).toBe(500);
});

/** Kapso needs a business number, which Setup will store; here a first start creates the tables and the test seeds it. */
async function kapsoServer(receivingMode: string | null, extraEnv: Record<string, string> = {}): Promise<Harness> {
  const fake = startFakeKapso({ apiKey: "key-1", phoneNumberId: "pn-1" });
  fakes.push(fake);
  const first = await boot();
  await first.close();
  const db = new Database(join(first.dataDir, "deputy.db"));
  db.run("INSERT INTO owner_numbers (number, kind, label, added_at) VALUES ('+50588880000', 'business', '', 1)");
  db.close();
  writeConfig(first.configDir, {
    provider: "kapso",
    kapso_phone_number_id: "pn-1",
    ...(receivingMode === null ? {} : { receiving_mode: receivingMode }),
  });
  writeFileSync(join(first.configDir, "secrets.env"), "kapso-api-key=key-1\nkapso-webhook-secret=hook-secret\n");
  started.pop();
  return boot(
    { DEPUTY_KAPSO_BASE_URL: fake.url, DEPUTY_PORT: String(first.port), ...extraEnv },
    { dataDir: first.dataDir, configDir: first.configDir },
  );
}

test("FR-INTAKE-02-11: Kapso with an empty receiving_mode binds no port", async () => {
  const h = await kapsoServer(null);
  await expect(fetch(url(h, "/health"))).rejects.toThrow();
});

test("FR-INTAKE-02-11: Kapso with receiving_mode live answers /health", async () => {
  const h = await kapsoServer("live");
  expect((await fetch(url(h, "/health"))).status).toBe(200);
});

test("hermetic: the server reads secrets from the namespace the harness sets, not from the real store", async () => {
  const service = `deputy-test-probe-${crypto.randomUUID()}`;
  await Bun.secrets.set({ service, name: "kapso-webhook-secret", value: "os-hook" });
  try {
    const h = await kapsoServer("live", { DEPUTY_SECRET_SERVICE: service });
    const raw = new TextEncoder().encode(
      JSON.stringify({ message: { id: "wamid.X1", timestamp: "1700000500", type: "text", from: "15557654321", text: { body: "hi" }, kapso: { direction: "inbound" } } }),
    );
    const sign = (secret: string) => new Bun.CryptoHasher("sha256", secret).update(raw).digest("hex");
    const post = (secret: string) =>
      fetch(url(h, "/webhook"), { method: "POST", headers: { "content-type": "application/json", "x-webhook-signature": sign(secret), "x-webhook-event": "whatsapp.message.received" }, body: new Blob([raw.slice().buffer]) });
    // secrets.env holds "hook-secret"; the namespaced OS entry wins, which proves the namespace is the one read
    expect((await post("os-hook")).status).toBe(200);
    expect((await post("hook-secret")).status).toBe(401);
  } finally {
    await Bun.secrets.delete({ service, name: "kapso-webhook-secret" });
  }
});
