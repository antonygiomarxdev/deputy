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

describe("documentation matches the new code (ADR-009, TD-9)", () => {
  const docs = ["README.md", "README.es.md", "CLAUDE.md"];
  const banned = ["operator/", "`reply`", "create_order", "handoff", "notify_owner", "permission relay", "DEPUTY_PROVIDER=meta", "npm run build", "node dist"];
  const read = (p: string) => readFileSync(join(root, p), "utf8");

  test.each(docs)("%s mentions none of the removed behavior", (path) => {
    const text = read(path).toLowerCase();
    for (const word of banned) expect(text).not.toContain(word.toLowerCase());
  });

  test("both READMEs have the same number of second-level headings", () => {
    const count = (p: string) => read(p).split("\n").filter((l) => l.startsWith("## ")).length;
    expect(count("README.md")).toBe(count("README.es.md"));
  });
});
