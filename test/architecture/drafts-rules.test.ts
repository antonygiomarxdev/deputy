import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { listImports } from "./imports";

type Sources = ReadonlyMap<string, string>; // path under the repo ("src/...") -> source

/** FR-KNOWLEDGE-01-14: ListDrafts calls nothing of Knowledge, so nothing under drafts/application may import it. */
export function knowledgeImportsInDraftsApplication(files: Sources): string[] {
  return [...files]
    .filter(([file]) => file.startsWith("src/drafts/application/"))
    .flatMap(([file, src]) => listImports(src).filter((s) => /(^|\/)knowledge(\/|$)/.test(s)).map((s) => `${file} imports ${s}`));
}

/** Only src/main.ts may import src/composition/mcp/. */
export function compositionMcpImportsOutsideMain(files: Sources): string[] {
  return [...files]
    .filter(([file]) => file !== "src/main.ts")
    .flatMap(([file, src]) =>
      listImports(src)
        .filter((s) => s.startsWith("."))
        .map((s) => posix.normalize(posix.join(posix.dirname(file), s)))
        .filter((target) => target === "src/composition/mcp" || target.startsWith("src/composition/mcp/"))
        // composition's own files may import each other
        .filter(() => !file.startsWith("src/composition/"))
        .map((target) => `${file} imports ${target}`),
    );
}

function realSources(): Sources {
  const root = join(import.meta.dir, "..", "..");
  const files = (readdirSync(join(root, "src"), { recursive: true }) as string[])
    .map((f) => `src/${f.replaceAll("\\", "/")}`)
    .filter((f) => f.endsWith(".ts"));
  return new Map(files.map((f) => [f, readFileSync(join(root, f), "utf8")]));
}

describe("drafts rules, on inline sources", () => {
  test("a Knowledge import under drafts/application is found, in every import form", () => {
    const files = new Map([
      ["src/drafts/application/a.ts", 'import { x } from "../../knowledge/index";'],
      ["src/drafts/application/b.ts", 'import type { P } from "../../knowledge/ports/catalog";'],
      ["src/drafts/application/c.ts", 'const m = await import("../../knowledge/index");'],
      ["src/drafts/application/ok.ts", 'import { y } from "../domain/draft";'],
      ["src/drafts/adapters/other.ts", 'import { z } from "../../knowledge/index";'],
    ]);
    expect(knowledgeImportsInDraftsApplication(files)).toHaveLength(3);
  });

  test("an import of composition/mcp outside main.ts is found; main.ts and composition itself are fine", () => {
    const files = new Map([
      ["src/main.ts", 'import { s } from "./composition/mcp/server";'],
      ["src/composition/mcp/server.ts", 'import { t } from "./composition-tools";'],
      ["src/drafts/adapters/x.ts", 'import { s } from "../../composition/mcp/server";'],
      ["src/intake/index.ts", 'export * from "../composition/mcp/instructions";'],
    ]);
    expect(compositionMcpImportsOutsideMain(files)).toEqual([
      "src/drafts/adapters/x.ts imports src/composition/mcp/server",
      "src/intake/index.ts imports src/composition/mcp/instructions",
    ]);
  });
});

describe("drafts rules, on the real src/", () => {
  test("drafts/application imports nothing of Knowledge", () => {
    expect(knowledgeImportsInDraftsApplication(realSources())).toEqual([]);
  });

  test("only src/main.ts imports src/composition/mcp/", () => {
    expect(compositionMcpImportsOutsideMain(realSources())).toEqual([]);
  });
});
