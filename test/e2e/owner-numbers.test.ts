import { Database } from "bun:sqlite";
import { afterEach, expect, test, setDefaultTimeout } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { startFakeKapso } from "../support/fake-kapso-server";
import { call, removeHarnessDirs, startServer, waitForOwner, writeConfig, type Harness, E2E_TIMEOUT_MS } from "../support/harness";

setDefaultTimeout(E2E_TIMEOUT_MS);

const open: Harness[] = [];
const fakes: { stop(): void }[] = [];
afterEach(async () => {
  for (const f of fakes.splice(0)) f.stop();
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

test("FR-INTAKE-04-9: a business number the owner's terminal left pending is applied at start, before Kapso is validated, and list_owner_numbers shows it with its command", async () => {
  const first = await startServer();
  open.push(first);
  await waitForOwner(first);
  await first.close();
  open.pop();

  // what `deputy config set business-number` writes; no owner_numbers row exists yet
  const db = new Database(join(first.dataDir, "deputy.db"));
  db.run(
    "INSERT INTO pending_changes (key, value, command, at) VALUES ('business_number', '+1 212 555 0100', 'deputy config set business-number \"+1 212 555 0100\"', 1)",
  );
  db.close();
  writeConfig(first.configDir, { provider: "kapso", kapso_phone_number_id: "pn-1" });
  writeFileSync(join(first.configDir, "secrets.env"), "kapso-api-key=key-1\n");
  const fake = startFakeKapso({ apiKey: "key-1", phoneNumberId: "pn-1" });
  fakes.push(fake);

  const h = await startServer(
    { DEPUTY_KAPSO_BASE_URL: fake.url, DEPUTY_PORT: String(first.port) },
    { dataDir: first.dataDir, configDir: first.configDir },
  );
  open.push(h);
  await waitForOwner(h); // without the business number, Kapso would have been refused and the server would have exited

  const listed = textOf(await call(h.client, "list_owner_numbers"));
  expect(listed).toContain("business: +12125550100");
  expect(listed).toContain('add +12125550100 (business): deputy config set business-number "+1 212 555 0100"');
  await h.close();
  const check = new Database(join(h.dataDir, "deputy.db"), { readonly: true });
  expect(check.query("SELECT applied_at IS NOT NULL AS applied FROM pending_changes").get()).toEqual({ applied: 1 });
  check.close();
});

test("a Kapso start with no business number anywhere is still refused", async () => {
  const first = await startServer();
  open.push(first);
  await waitForOwner(first);
  await first.close();
  open.pop();
  writeConfig(first.configDir, { provider: "kapso", kapso_phone_number_id: "pn-1" });
  writeFileSync(join(first.configDir, "secrets.env"), "kapso-api-key=key-1\n");
  await expect(startServer({ DEPUTY_PORT: String(first.port) }, { dataDir: first.dataDir, configDir: first.configDir })).rejects.toThrow();
});

test("list_owner_numbers with nothing set says so", async () => {
  const h = await startServer();
  open.push(h);
  await waitForOwner(h);
  const listed = textOf(await call(h.client, "list_owner_numbers"));
  expect(listed).toContain("no owner numbers");
  expect(listed).toContain("no changes yet");
});
