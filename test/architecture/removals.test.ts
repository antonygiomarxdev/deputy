import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const root = join(import.meta.dir, "..", "..");

const removed = [
  "operator",
  "scripts/start.sh",
  "src/server.ts",
  "src/conversations.ts",
  "src/config.ts",
  "src/types.ts",
  "src/providers",
  "src/store",
  "test/e2e.test.mjs",
  "test/unit.test.mjs",
  "package-lock.json",
];

describe("removals (ADR-009, ADR-010)", () => {
  test.each(removed)("%s does not exist", (path) => {
    expect(existsSync(join(root, path))).toBe(false);
  });

  test("package.json uses Bun scripts and no Node-only dev tools", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts.test).toBe("bun test");
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps).not.toHaveProperty("tsx");
    expect(deps).not.toHaveProperty("@types/node");
  });
});
