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
    .filter(([file]) => file !== "src/main.ts" && !file.startsWith("src/main/"))
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

/** FR-DRAFTS-02-7: of the use cases, only approve-draft.ts may import the Sender port. */
export function senderImportsInDraftsApplication(files: Sources): string[] {
  return [...files]
    .filter(([file]) => file.startsWith("src/drafts/application/") && file !== "src/drafts/application/approve-draft.ts")
    .flatMap(([file, src]) => listImports(src).filter((s) => /(^|\/)ports\/sender$/.test(s)).map((s) => `${file} imports ${s}`));
}

/** FR-DRAFTS-02-7: Intake's SendText is reached only through src/drafts/adapters/intake/intake-sender.ts. */
export function sendTextOutsideIntakeSender(files: Sources): string[] {
  return [...files]
    .filter(([file]) => file.startsWith("src/drafts/") && file !== "src/drafts/adapters/intake/intake-sender.ts")
    .filter(([, src]) => /\bSendText\b/.test(src))
    .map(([file]) => `${file} mentions SendText`);
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

  test("an import of composition/mcp outside the composition root is found; src/main.ts, src/main/ and composition itself are fine", () => {
    const files = new Map([
      ["src/main.ts", 'import { s } from "./composition/mcp/server";'],
      ["src/main/tools.ts", 'import { s } from "../composition/mcp/server";'],
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

describe("send-path rules, on inline sources", () => {
  test("a use case other than approve-draft that imports the Sender port is found", () => {
    const files = new Map([
      ["src/drafts/application/approve-draft.ts", 'import type { Sender } from "../ports/sender";'],
      ["src/drafts/application/create-draft.ts", 'import type { Sender } from "../ports/sender";'],
      ["src/drafts/application/list-drafts.ts", 'import type { X } from "../ports/outbound";'],
      ["src/drafts/adapters/memory/fake-sender.ts", 'import type { Sender } from "../../ports/sender";'],
    ]);
    expect(senderImportsInDraftsApplication(files)).toEqual(["src/drafts/application/create-draft.ts imports ../ports/sender"]);
  });

  test("a mention of SendText outside intake-sender.ts is found", () => {
    const files = new Map([
      ["src/drafts/adapters/intake/intake-sender.ts", 'import type { SendText } from "../../../intake/index";'],
      ["src/drafts/adapters/mcp/drafts-tools.ts", 'import type { SendText } from "../../../intake/index";'],
      ["src/drafts/application/ok.ts", "export const x = 1; // only SendTextResult is named here"],
    ]);
    expect(sendTextOutsideIntakeSender(files)).toEqual(["src/drafts/adapters/mcp/drafts-tools.ts mentions SendText"]);
  });
});

describe("drafts rules, on the real src/", () => {
  test("drafts/application imports nothing of Knowledge", () => {
    expect(knowledgeImportsInDraftsApplication(realSources())).toEqual([]);
  });

  test("only approve-draft.ts imports the Sender port, and only intake-sender.ts reaches SendText", () => {
    expect(senderImportsInDraftsApplication(realSources())).toEqual([]);
    expect(sendTextOutsideIntakeSender(realSources())).toEqual([]);
  });

  test("only src/main.ts and src/main/ import src/composition/mcp/", () => {
    expect(compositionMcpImportsOutsideMain(realSources())).toEqual([]);
  });
});
