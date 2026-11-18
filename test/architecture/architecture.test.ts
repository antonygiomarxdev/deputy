import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { listImports } from "./imports";

export interface Violation {
  rule: string;
  file: string;
  specifier: string;
}

type Loc =
  | { kind: "main" | "shared" | "adapters" | "composition" }
  | { kind: "slice"; slice: string; layer: string; isIndex: boolean };

const CORE_LAYERS = new Set(["domain", "application", "ports"]);
const DRAFTS_FORBIDDEN = new Set(["inbox", "notify", "knowledge", "setup"]);
const CUSTOMER_TEXT_HELPER = "src/adapters/mcp/customer-text.ts";

function locate(file: string): Loc {
  const parts = file.split("/");
  const first = parts[1] ?? "";
  const second = parts[2] ?? "";
  if (first === "main.ts") return { kind: "main" };
  if (first === "shared" || first === "adapters" || first === "composition") return { kind: first };
  return { kind: "slice", slice: first, layer: second, isIndex: parts.length === 3 && second === "index.ts" };
}

const isCore = (l: Loc) => l.kind === "shared" || (l.kind === "slice" && CORE_LAYERS.has(l.layer));

export function checkArchitecture(root: string): Violation[] {
  const files = (readdirSync(join(root, "src"), { recursive: true }) as string[])
    .map((f) => `src/${f.replaceAll("\\", "/")}`)
    .filter((f) => f.endsWith(".ts"));
  const known = new Set(files);
  const sources = new Map(files.map((f) => [f, readFileSync(join(root, f), "utf8")]));
  const out: Violation[] = [];
  const edges = new Map<string, Map<string, Violation>>();

  const resolve = (file: string, spec: string): string | null => {
    const base = posix.normalize(posix.join(posix.dirname(file), spec));
    return [base, `${base}.ts`, `${base}/index.ts`].find((c) => known.has(c)) ?? null;
  };

  // Names a file imports (`{ X }` or `{ X as Y }`, the local name) from a file under an `adapters/` folder.
  const importedAdapters = (file: string, src: string): string[] =>
    [...src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'](\.[^"']*)["']/g)].flatMap((m) => {
      const target = resolve(file, m[2] as string);
      if (!target?.split("/").includes("adapters")) return [];
      return (m[1] as string).split(",").map((n) => (n.split(/\s+as\s+/).pop() ?? "").trim()).filter(Boolean);
    });

  for (const [file, src] of sources) {
    const from = locate(file);
    const add = (rule: string, specifier: string) => out.push({ rule, file, specifier });

    if (file !== "src/main.ts") {
      for (const cls of importedAdapters(file, src)) {
        if (new RegExp(`\\bnew\\s+${cls}\\s*\\(`).test(src)) add("adapter-instantiated", cls);
      }
    }
    if (file !== CUSTOMER_TEXT_HELPER && src.includes("<customer_text")) add("customer-text-label", "<customer_text");

    for (const spec of listImports(src)) {
      if (!spec.startsWith(".")) {
        if (isCore(from)) add("shared-or-core-imports-package", spec);
        continue;
      }
      const target = resolve(file, spec);
      if (!target) continue; // non-.ts assets such as .sql
      const to = locate(target);

      if (to.kind === "main") add("imports-main", spec);
      if (to.kind === "composition" && file !== "src/main.ts") add("composition-imported-outside", spec);
      const mayUseSharedAdapters =
        from.kind === "adapters" ||
        from.kind === "composition" ||
        from.kind === "main" ||
        (from.kind === "slice" && from.layer === "adapters");
      if (to.kind === "adapters" && !mayUseSharedAdapters) add("adapter-folder-misuse", spec);
      if (from.kind === "adapters" && to.kind === "slice") add("shared-adapter-imports-slice", spec);
      if (from.kind === "composition" && to.kind === "slice" && !to.isIndex) add("composition-imports-internal", spec);

      if (from.kind === "slice") {
        const sameSlice = to.kind === "slice" && to.slice === from.slice;
        if (to.kind === "slice" && !sameSlice) {
          if (!to.isIndex) add("cross-slice-internal", spec);
          if (isCore(from)) add("cross-slice-from-core", spec);
          if (from.slice === "drafts" && DRAFTS_FORBIDDEN.has(to.slice)) add("drafts-forbidden-edge", spec);
          const next = edges.get(from.slice) ?? new Map<string, Violation>();
          if (!next.has(to.slice)) next.set(to.slice, { rule: "slice-cycle", file, specifier: spec });
          edges.set(from.slice, next);
        }
        const toAdapters = to.kind === "adapters" || (to.kind === "slice" && to.layer === "adapters");
        const sameLayer = (...layers: string[]) => sameSlice && to.kind === "slice" && layers.includes(to.layer);
        if (from.layer === "domain" && !(to.kind === "shared" || sameLayer("domain"))) add("domain-imports-outside", spec);
        if (from.layer === "application" && toAdapters) add("application-imports-adapters", spec);
        if (from.layer === "ports" && !(to.kind === "shared" || sameLayer("domain", "ports"))) add("ports-imports-outside", spec);
      }
    }
  }

  // A back edge in a depth-first walk of the slice graph closes a cycle.
  const state = new Map<string, "open" | "done">();
  const walk = (slice: string): void => {
    state.set(slice, "open");
    for (const [next, edge] of edges.get(slice) ?? []) {
      if (state.get(next) === "open") out.push(edge);
      else if (!state.has(next)) walk(next);
    }
    state.set(slice, "done");
  };
  for (const slice of edges.keys()) if (!state.has(slice)) walk(slice);

  return out;
}

describe("listImports", () => {
  test("finds every import form", () => {
    const source = [
      'import a from "x";',
      'import type { B } from "./b";',
      'export * from "../c";',
      'export { d } from "e";',
      'const f = await import("f");',
      'const g = require("g");',
    ].join("\n");
    expect(listImports(source)).toEqual(["x", "./b", "../c", "e", "f", "g"]);
  });
});

const fixtures = join(import.meta.dir, "fixtures");

describe("checkArchitecture", () => {
  const rules = [
    "shared-or-core-imports-package",
    "domain-imports-outside",
    "application-imports-adapters",
    "ports-imports-outside",
    "cross-slice-internal",
    "cross-slice-from-core",
    "composition-imported-outside",
    "composition-imports-internal",
    "slice-cycle",
    "drafts-forbidden-edge",
    "shared-adapter-imports-slice",
    "adapter-folder-misuse",
    "imports-main",
    "adapter-instantiated",
    "customer-text-label",
  ];
  const found = (name: string) => [...new Set(checkArchitecture(join(fixtures, name)).map((v) => v.rule))].sort();

  test("a valid tree has no violations", () => {
    expect(found("valid")).toEqual([]);
  });
  for (const rule of rules) {
    test(`fixture ${rule} violates exactly that rule`, () => {
      expect(found(rule)).toEqual([rule]);
    });
  }

  test("the real src/ has no violations", () => {
    expect(checkArchitecture(join(import.meta.dir, "..", ".."))).toEqual([]);
  });
});
