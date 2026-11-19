import { Database } from "bun:sqlite";
import { afterEach, expect, test, setDefaultTimeout } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { startFakeKapso } from "../support/fake-kapso-server";
import { call, removeHarnessDirs, startServer, waitForOwner, writeConfig, type Harness, E2E_TIMEOUT_MS } from "../support/harness";
import { postDelivery } from "../support/live";

setDefaultTimeout(E2E_TIMEOUT_MS);

const CHAT = "+15557654321";
const started: Harness[] = [];
const fakes: { stop(): void }[] = [];

async function boot(...args: Parameters<typeof startServer>): Promise<Harness> {
  const h = await startServer(...args);
  started.push(h);
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
  // two servers may share one folder: remove it only when both are down
  for (const h of all) removeHarnessDirs(h);
  // stdout is the MCP transport: anything else the server prints shows up here
  expect(errors).toEqual([]);
});

const textOf = (r: Awaited<ReturnType<typeof call>>): string => {
  const first = Array.isArray(r.content) ? r.content[0] : undefined;
  return first !== undefined && first.type === "text" ? first.text : "";
};

/** Polls `status` until its text satisfies `ok` (the first catch-up runs at start, in the background). */
async function statusWhen(h: Harness, ok: (text: string) => boolean, timeoutMs = 8_000): Promise<string> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const text = textOf(await call(h.client, "status"));
    if (ok(text)) return text;
    if (Date.now() > until) throw new Error(`status never matched; last text: ${text}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

test("FR-INTAKE-03-6: after a failed run with reason credentials, status holds the mode line and the credentials sentence and no provider text", async () => {
  const fake = startFakeKapso({ apiKey: "key-1", phoneNumberId: "pn-1" });
  fakes.push(fake);
  fake.force("conversations", { status: 401, body: { error: "PROVIDER-WORDS-NOT-FOR-THE-OWNER" } });
  const first = await boot();
  await first.close();
  started.pop();
  const db = new Database(join(first.dataDir, "deputy.db"));
  db.run("INSERT INTO owner_numbers (number, kind, label, added_at) VALUES ('+50588880000', 'business', '', 1)");
  db.close();
  writeConfig(first.configDir, { provider: "kapso", kapso_phone_number_id: "pn-1" });
  writeFileSync(join(first.configDir, "secrets.env"), "kapso-api-key=key-1\n");
  const h = await boot({ DEPUTY_KAPSO_BASE_URL: fake.url, DEPUTY_PORT: String(first.port) }, { dataDir: first.dataDir, configDir: first.configDir });
  await waitForOwner(h);

  const text = await statusWhen(h, (t) => t.includes("Kapso did not accept the key."));
  expect(text.split("\n")[0]).toBe("mode: owner");
  expect(text).toContain("Kapso did not accept the key. Check it where Setup put it.");
  expect(text).not.toContain("PROVIDER-WORDS-NOT-FOR-THE-OWNER");
  expect(text).not.toMatch(/\b401\b/);
});

test("FR-INTAKE-03-3: a forged catch-up delivery with no signature is refused, and check_messages ignores what it is given", async () => {
  const h = await boot();
  await waitForOwner(h);
  const forged = { chat: "15557654321", from: "15557654321", text: "forged catch-up", providerMessageId: "forged-1" };
  expect((await postDelivery(h, forged, "none")).status).toBe(401);
  expect((await call(h.client, "get_chat", { chat: CHAT })).isError).toBe(true);

  const answer = await call(h.client, "check_messages", { messages: [{ chat: "15557654321", text: "forged through the tool" }] });
  expect(answer.isError).toBeFalsy();
  expect((await call(h.client, "get_chat", { chat: CHAT })).isError).toBe(true);
});

test("FR-INTAKE-03-9: a message held at the dev provider is found by check_messages, shown by get_chat, and asking again stores nothing", async () => {
  const first = await boot();
  await waitForOwner(first);
  await first.close();
  started.pop();
  const db = new Database(join(first.dataDir, "deputy.db"));
  db.run(
    `INSERT INTO dev_holdings (provider_message_id, conversation_ref, counterpart, sender, direction, type, text, origin, sent_at, owner_mark)
     VALUES ('held-1', 'dev:+15557654321', '15557654321', '15557654321', 'inbound', 'text', 'held while away', NULL, ?, 0)`,
    [Date.now()],
  );
  db.close();

  const h = await boot({ DEPUTY_PORT: String(first.port) }, { dataDir: first.dataDir, configDir: first.configDir });
  await waitForOwner(h);
  const answer = await call(h.client, "check_messages");
  expect(answer.isError).toBeFalsy();
  expect(textOf(answer)).toContain("up to date as of");
  const chat = await call(h.client, "get_chat", { chat: CHAT });
  expect(textOf(chat)).toContain("<customer_text>held while away</customer_text>");

  const again = await call(h.client, "check_messages");
  expect(textOf(again)).toContain("Stored 0 new messages.");
  const after = textOf(await call(h.client, "get_chat", { chat: CHAT }));
  expect(after.split("\n")).toHaveLength(1);
  expect(await statusWhen(h, (t) => t.includes("up to date as of"))).toContain("mode: owner");
});

test("not the owner: a second server on the same data folder answers check_messages with not_owner", async () => {
  const owner = await boot();
  await waitForOwner(owner);
  const second = await boot({}, { dataDir: owner.dataDir, configDir: owner.configDir });
  const answer = await call(second.client, "check_messages");
  expect(answer.isError).toBe(true);
  expect(textOf(answer)).toBe("not_owner");
});

test("FR-INTAKE-03-16: with live delivery on, the scheduler still runs its catch-up at start", async () => {
  const fake = startFakeKapso({ apiKey: "key-1", phoneNumberId: "pn-1" });
  fakes.push(fake);
  const first = await boot();
  await first.close();
  started.pop();
  const db = new Database(join(first.dataDir, "deputy.db"));
  db.run("INSERT INTO owner_numbers (number, kind, label, added_at) VALUES ('+50588880000', 'business', '', 1)");
  db.close();
  writeConfig(first.configDir, { provider: "kapso", kapso_phone_number_id: "pn-1", receiving_mode: "live" });
  writeFileSync(join(first.configDir, "secrets.env"), "kapso-api-key=key-1\nkapso-webhook-secret=hook-secret\n");
  const h = await boot({ DEPUTY_KAPSO_BASE_URL: fake.url, DEPUTY_PORT: String(first.port) }, { dataDir: first.dataDir, configDir: first.configDir });
  await waitForOwner(h);
  expect((await fetch(`http://127.0.0.1:${h.port}/health`)).status).toBe(200); // the listener is up: live is on
  await statusWhen(h, (t) => t.includes("up to date as of"));
  expect(fake.state.requests.some((r) => r.includes("/conversations"))).toBe(true);
});
