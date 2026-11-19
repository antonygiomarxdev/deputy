import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Bun applies setDefaultTimeout per file, so a preload cannot set it for the e2e files.
describe("e2e test files", () => {
  test("every test/e2e file sets the e2e timeout itself", () => {
    const dir = join(import.meta.dir, "..", "e2e");
    const files = readdirSync(dir).filter((n) => n.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(0);
    const missing = files.filter((n) => !/^setDefaultTimeout\(E2E_TIMEOUT_MS\);$/m.test(readFileSync(join(dir, n), "utf8")));
    expect(missing).toEqual([]);
  });
});
