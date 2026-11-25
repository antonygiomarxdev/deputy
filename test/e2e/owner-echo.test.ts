import { afterEach, expect, test, setDefaultTimeout } from "bun:test";
import { call, holdOwnerReply, insertPendingChange, removeHarnessDirs, startServer, waitForOwner, type Harness, E2E_TIMEOUT_MS } from "../support/harness";
import { postDelivery } from "../support/live";

setDefaultTimeout(E2E_TIMEOUT_MS);

const CHAT = "+15557654321";
const CUSTOMER = "15557654321";

const open: Harness[] = [];
afterEach(async () => {
  const errors: Error[] = [];
  for (const h of open.splice(0)) {
    errors.push(...h.protocolErrors);
    await h.close().catch(() => 0);
    removeHarnessDirs(h);
  }
  // stdout is the MCP transport: anything else the server prints shows up here
  expect(errors).toEqual([]);
});

async function boot(): Promise<Harness> {
  const h = await startServer();
  open.push(h);
  await waitForOwner(h);
  return h;
}

const textOf = (r: Awaited<ReturnType<typeof call>>): string => {
  const first = Array.isArray(r.content) ? r.content[0] : undefined;
  return first !== undefined && first.type === "text" ? first.text : "";
};

// covers: intake/FRD-04/EX-7
test("FR-INTAKE-04-4: a reply the owner wrote from the app while Deputy was off is found by check_messages and shown as the owner's", async () => {
  const h = await boot();
  await holdOwnerReply(h, { chat: CUSTOMER, text: "Yes, until 6 pm.", sentAt: Date.now() });

  const checked = await call(h.client, "check_messages");
  expect(checked.isError).toBeFalsy();
  expect(textOf(checked)).toContain("Stored 1 new message.");

  const chat = textOf(await call(h.client, "get_chat", { chat: CHAT }));
  expect(chat).toContain("owner from the app");
  expect(chat).toContain("<customer_text>Yes, until 6 pm.</customer_text>");
  expect(chat).not.toContain("| customer |");
});

test("FR-INTAKE-04-4: with live delivery on, a reply that only the provider holds is still stored by the next check_messages, after the customer's live message", async () => {
  const h = await boot();
  expect((await postDelivery(h, { chat: CUSTOMER, from: CUSTOMER, text: "Are you open?", sentAt: 1_000, providerMessageId: "dev-in-1" })).status).toBe(200);
  await holdOwnerReply(h, { chat: CUSTOMER, text: "Yes we are.", sentAt: 2_000 });
  expect(textOf(await call(h.client, "check_messages"))).toContain("Stored 1 new message.");

  const lines = textOf(await call(h.client, "get_chat", { chat: CHAT })).split("\n");
  expect(lines).toHaveLength(2);
  expect(lines[0]).toContain("customer");
  expect(lines[0]).toContain("Are you open?");
  expect(lines[1]).toContain("owner from the app");
  expect(lines[1]).toContain("Yes we are.");
});

test("FR-INTAKE-04-1 and FR-INTAKE-04-9: a pending change written while the server runs is applied within one supervisor tick and listed with its typed command", async () => {
  const h = await boot();
  expect(textOf(await call(h.client, "list_owner_numbers"))).toContain("no owner numbers");
  insertPendingChange(h, "owner_numbers", "+1 212 555 0103", 'deputy config set owner-numbers "+1 212 555 0103"');

  const until = Date.now() + 15_000;
  let listed = "";
  while (Date.now() < until) {
    listed = textOf(await call(h.client, "list_owner_numbers"));
    if (listed.includes("extra: +12125550103")) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  expect(listed).toContain("extra: +12125550103");
  expect(listed).toContain('add +12125550103 (extra): deputy config set owner-numbers "+1 212 555 0103"');
}, 20_000);
