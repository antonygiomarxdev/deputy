import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Bun applies setDefaultTimeout per file: a preload or bunfig timeout does not reach the other files.
const CALL = /^setDefaultTimeout\(E2E_TIMEOUT_MS\);\r?$/m;
const root = join(import.meta.dir, "..", "..");
const SLOW_NON_E2E = [
  "test/architecture/architecture.test.ts", // scans the real src/
  "test/adapters/sqlite/lease.two-process.test.ts", // spawns processes
  "test/drafts/acceptance/drafts-mcp.e2e.test.ts", // spawns a server
  "test/intake/acceptance/catch-up-failures.test.ts", // a 1 s loop over MAX_PAGES
];

describe("e2e test files", () => {
  test("every test/e2e file sets the e2e timeout itself", () => {
    const dir = join(root, "test", "e2e");
    const files = readdirSync(dir).filter((n) => n.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(0);
    const missing = files.filter((n) => !CALL.test(readFileSync(join(dir, n), "utf8")));
    expect(missing).toEqual([]);
  });

  test("the slow non-e2e files named in SLOW_NON_E2E set the e2e timeout too", () => {
    const missing = SLOW_NON_E2E.filter((p) => !CALL.test(readFileSync(join(root, p), "utf8")));
    expect(missing).toEqual([]);
  });
});
