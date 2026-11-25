// covers: intake/FRD-01/EX-3
// covers: intake/FRD-01/EX-4
// covers: intake/FRD-01/EX-7
// covers: intake/FRD-01/EX-8
// covers: intake/FRD-01/EX-13
// covers: intake/FRD-01/EX-14
import { Database } from "bun:sqlite";
import { afterEach, expect, test, setDefaultTimeout } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { startFakeKapso } from "../support/fake-kapso-server";
import { call, removeHarnessDirs, startServer, waitForOwner, writeConfig, type Harness, E2E_TIMEOUT_MS } from "../support/harness";
import { url } from "../support/live";

setDefaultTimeout(E2E_TIMEOUT_MS);

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
  const all = started.splice(0);
  for (const h of all) {
    errors.push(...h.protocolErrors);
    await h.close().catch(() => 0);
  }
  for (const h of all) removeHarnessDirs(h);
  // stdout is the MCP transport: anything else the server prints shows up here
  expect(errors).toEqual([]);
});

const textOf = (r: Awaited<ReturnType<typeof call>>): string => {
  const first = Array.isArray(r.content) ? r.content[0] : undefined;
  return first !== undefined && first.type === "text" ? first.text : "";
};
const post = (h: Harness, path: string, body: unknown) =>
  fetch(url(h, path), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const chatText = async (h: Harness, chat: string) => textOf(await call(h.client, "get_chat", { chat }));

test("FR-INTAKE-01-3: a tester's message to /dev/deliver is stored and get_chat shows it; a body without chat is a 400 naming it", async () => {
  const h = await boot();
  const res = await post(h, "/dev/deliver", { chat: "12125550111", from: "12125550111", text: "How much is the cake?" });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ result: "stored" });
  const text = await chatText(h, "+12125550111");
  expect(text).toContain("<customer_text>How much is the cake?</customer_text>");
  expect(text).toContain("customer");

  const bad = await post(h, "/dev/deliver", { from: "12125550111", text: "no chat here" });
  expect(bad.status).toBe(400);
  expect((await bad.json()) as { fields: string[] }).toMatchObject({ fields: ["chat"] });
  expect((await chatText(h, "+12125550111")).split("\n")).toHaveLength(1);

  const badNumber = await post(h, "/dev/deliver", { chat: "not a number", from: "12125550111", text: "x" });
  expect(badNumber.status).toBe(400);
  expect(await badNumber.json()).toEqual({ error: "invalid_chat" });
});

test("FR-INTAKE-01-5: unreadable, transcript, repeated, reversed, owner, history and forged deliveries each give their result", async () => {
  const h = await boot();
  const deliver = (chat: string, over: Record<string, unknown>) => post(h, "/dev/deliver", { chat, from: chat, text: "", ...over });

  await deliver("12125550151", { type: "image" });
  expect(await chatText(h, "+12125550151")).toContain("[image, not readable]");

  await deliver("12125550152", { type: "audio", transcript: "two kilos of cheese" });
  expect(await chatText(h, "+12125550152")).toContain("voice note, transcript: two kilos of cheese");

  expect(await (await deliver("12125550153", { text: "once", providerMessageId: "dev-r" })).json()).toEqual({ result: "stored" });
  expect(await (await deliver("12125550153", { text: "once", providerMessageId: "dev-r" })).json()).toEqual({ result: "duplicate" });
  expect((await chatText(h, "+12125550153")).split("\n")).toHaveLength(1);

  await deliver("12125550154", { text: "second", sentAt: 2_000 });
  await deliver("12125550154", { text: "first", sentAt: 1_000 });
  const order = (await chatText(h, "+12125550154")).split("\n");
  expect(order[0]).toContain("first");
  expect(order[1]).toContain("second");

  await deliver("12125550155", { text: "from the shop", owner: true });
  expect(await chatText(h, "+12125550155")).toContain("owner from the app");

  await deliver("12125550156", { text: "ancient", history: true });
  expect(await chatText(h, "+12125550156")).toContain("history");

  const delivery = { chat: "12125550157", from: "12125550157", text: "forged" };
  expect((await post(h, "/dev/forge", { ...delivery, signature: "sha256=00" })).status).toBe(401);
  expect((await post(h, "/dev/forge", delivery)).status).toBe(401);
  expect((await call(h.client, "get_chat", { chat: "+12125550157" })).isError).toBe(true);
  const rejected = textOf(await call(h.client, "rejected_deliveries"));
  expect(rejected).toContain("bad_signature");
  expect(rejected).toContain("missing_signature");
  expect(rejected).not.toContain("forged");
});

test("FR-INTAKE-01-6: a body held with /dev/hold is found by the next catch-up, once", async () => {
  const h = await boot();
  const res = await post(h, "/dev/hold", { chat: "12125550120", from: "12125550120", text: "held while away" });
  expect(res.status).toBe(204);
  expect((await call(h.client, "get_chat", { chat: "+12125550120" })).isError).toBe(true);

  const answer = await call(h.client, "check_messages");
  expect(answer.isError).toBeFalsy();
  expect(await chatText(h, "+12125550120")).toContain("<customer_text>held while away</customer_text>");
  await call(h.client, "check_messages");
  expect((await chatText(h, "+12125550120")).split("\n")).toHaveLength(1);
});

test("FR-INTAKE-01-9: under Kapso every /dev path is a 404 with a dev_entry_refused note and nothing stored", async () => {
  const fake = startFakeKapso({ apiKey: "key-1", phoneNumberId: "pn-1" });
  fakes.push(fake);
  const first = await boot();
  await first.close();
  started.pop();
  const db = new Database(join(first.dataDir, "deputy.db"));
  db.run("INSERT INTO owner_numbers (number, kind, label, added_at) VALUES ('+12125550100', 'business', '', 1)");
  db.close();
  writeConfig(first.configDir, { provider: "kapso", kapso_phone_number_id: "pn-1", receiving_mode: "live" });
  writeFileSync(join(first.configDir, "secrets.env"), "kapso-api-key=key-1\nkapso-webhook-secret=hook-secret\n");
  const h = await boot({ DEPUTY_KAPSO_BASE_URL: fake.url, DEPUTY_PORT: String(first.port) }, { dataDir: first.dataDir, configDir: first.configDir });

  const body = { chat: "12125550111", from: "12125550111", text: "should not land" };
  expect((await post(h, "/dev/deliver", body)).status).toBe(404);
  expect((await post(h, "/dev/hold", body)).status).toBe(404);
  expect((await post(h, "/dev/forge", body)).status).toBe(404);
  expect((await call(h.client, "get_chat", { chat: "+12125550111" })).isError).toBe(true);
  const rejected = textOf(await call(h.client, "rejected_deliveries"));
  expect(rejected.match(/dev_entry_refused/g)).toHaveLength(3);
  expect(rejected).not.toContain("should not land");
});

test("a web page cannot plant a message: an Origin, a plain-text body or a foreign Host is refused and nothing is stored", async () => {
  const h = await boot();
  const body = JSON.stringify({ chat: "12125550130", from: "12125550130", text: "planted by a page" });
  const send = (path: string, headers: Record<string, string>) => fetch(url(h, path), { method: "POST", headers, body });
  const json = { "content-type": "application/json" };
  expect((await send("/dev/deliver", { ...json, origin: "https://evil.example" })).status).toBe(403);
  expect((await send("/dev/deliver", { "content-type": "text/plain" })).status).toBe(415);
  expect((await send("/dev/deliver", { ...json, host: "evil.example" })).status).toBe(403);
  // the dev webhook secret is a public constant: a page could sign with it, so the dev webhook is checked too
  expect((await send("/webhook", { ...json, host: "evil.example", "x-webhook-signature": "sha256=00" })).status).toBe(403);
  expect((await send("/webhook", { ...json, origin: "https://evil.example" })).status).toBe(403);
  expect((await call(h.client, "get_chat", { chat: "+12125550130" })).isError).toBe(true);
  expect((await send("/dev/deliver", json)).status).toBe(200);
});
