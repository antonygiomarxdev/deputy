import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSecretStore } from "../../../src/adapters/secrets/secret-store";

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "deputy-sec-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("the OS store wins and the file is not read", async () => {
  const configDir = tempDir();
  writeFileSync(join(configDir, "secrets.env"), "kapso-api-key=fromfile\n");
  const s = createSecretStore({ os: { get: async () => "fromos" }, configDir });
  expect(await s.get("kapso-api-key")).toEqual({ value: "fromos", where: "os_store" });
});

test("a throwing OS store falls back to secrets.env", async () => {
  const configDir = tempDir();
  writeFileSync(join(configDir, "secrets.env"), "other=1\nkapso-api-key=abc\n");
  const s = createSecretStore({
    os: { get: async () => { throw new Error("no keyring"); } },
    configDir,
  });
  expect(await s.get("kapso-api-key")).toEqual({ value: "abc", where: "file" });
});

test("neither holds the secret: null", async () => {
  const s = createSecretStore({ os: { get: async () => null }, configDir: tempDir() });
  expect(await s.get("kapso-api-key")).toBeNull();
});
