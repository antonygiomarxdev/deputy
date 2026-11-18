import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileConnectionConfig } from "../../../src/intake/adapters/config/file-connection-config";
import { FakeSecretStore } from "../../support/fake-secret-store";

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "deputy-cfg-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("reads config.json and the two secrets as Secret", async () => {
  const configDir = tempDir();
  writeFileSync(
    join(configDir, "config.json"),
    JSON.stringify({ provider: "kapso", receiving_mode: "live", kapso_phone_number_id: "123" }),
  );
  const secrets = new FakeSecretStore({ "kapso-api-key": "key1", "kapso-webhook-secret": "hook1" });
  const c = await new FileConnectionConfig({ configDir, secrets }).read();
  expect(c.provider).toBe("kapso");
  expect(c.receivingMode).toBe("live");
  expect(c.kapso.phoneNumberId).toBe("123");
  expect(c.kapso.apiKey?.reveal()).toBe("key1");
  expect(c.kapso.webhookSecret?.reveal()).toBe("hook1");
  expect(JSON.stringify(c)).not.toContain("key1");
});

test("no file and no secrets: every field is null", async () => {
  const c = await new FileConnectionConfig({ configDir: tempDir(), secrets: new FakeSecretStore() }).read();
  expect(c).toEqual({
    provider: null,
    receivingMode: null,
    kapso: { apiKey: null, phoneNumberId: null, webhookSecret: null },
  });
});
