import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Bun applies setDefaultTimeout per file: a preload or bunfig timeout does not reach the other files.
const CALL = /^setDefaultTimeout\(E2E_TIMEOUT_MS\);\r?$/m;
const USES_HARNESS = /support\/harness"/;
const root = join(import.meta.dir, "..", "..");
const testFiles = () =>
  readdirSync(join(root, "test"), { recursive: true })
    .map(String)
    .filter((n) => n.endsWith(".test.ts"));
const read = (rel: string) => readFileSync(join(root, "test", rel), "utf8");

describe("e2e test files", () => {
  test("every test/e2e file sets the e2e timeout itself", () => {
    const files = testFiles().filter((n) => /^e2e[\\/]/.test(n));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((n) => !CALL.test(read(n)))).toEqual([]);
  });

  test("every test file that imports the server harness sets the e2e timeout too", () => {
    const files = testFiles().filter((n) => USES_HARNESS.test(read(n)));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((n) => !CALL.test(read(n)))).toEqual([]);
  });
});
