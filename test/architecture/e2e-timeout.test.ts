import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Bun applies setDefaultTimeout per file: a preload or bunfig timeout does not reach the other files.
const CALL = /^setDefaultTimeout\(E2E_TIMEOUT_MS\);\r?$/m;
const root = join(import.meta.dir, "..", "..");
const HARNESS = join(root, "test", "support", "harness");
const SLOW_NON_E2E = [
  "test/architecture/architecture.test.ts", // scans the real src/
  "test/adapters/sqlite/lease.two-process.test.ts", // spawns processes
  "test/intake/acceptance/catch-up-failures.test.ts", // a 1 s loop over MAX_PAGES
];
const testFiles = () =>
  readdirSync(join(root, "test"), { recursive: true })
    .map(String)
    .filter((n) => n.endsWith(".test.ts"));
// a relative import is resolved, so "./harness" in test/support counts and another folder's own harness does not
const usesHarness = (rel: string) =>
  [...read(rel).matchAll(/from "(\.[^"]*)"/g)].some((m) => resolve(dirname(join(root, "test", rel)), m[1]!) === HARNESS);
const read = (rel: string) => readFileSync(join(root, "test", rel), "utf8");

describe("e2e test files", () => {
  test("every test/e2e file sets the e2e timeout itself", () => {
    const files = testFiles().filter((n) => /^e2e[\\/]/.test(n));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((n) => !CALL.test(read(n)))).toEqual([]);
  });

  test("every test file that imports the server harness sets the e2e timeout too", () => {
    const files = testFiles().filter(usesHarness);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((n) => !CALL.test(read(n)))).toEqual([]);
  });

  test("the slow non-e2e files named in SLOW_NON_E2E set the e2e timeout too", () => {
    const missing = SLOW_NON_E2E.filter((p) => !CALL.test(readFileSync(join(root, p), "utf8")));
    expect(missing).toEqual([]);
  });
});
