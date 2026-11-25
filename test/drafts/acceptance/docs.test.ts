import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INSTRUCTIONS } from "../../../src/composition/mcp/instructions";

const root = join(import.meta.dir, "..", "..", "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

// covers: drafts/FRD-02/EX-25
// covers: drafts/FRD-02/EX-26
test("FR-DRAFTS-02-11: the known limit is written in both READMEs and in INSTRUCTIONS", () => {
  const en = read("README.md");
  expect(en).toContain("controls only its own send path");
  expect(en).toContain("other tools");
  const es = read("README.es.md");
  expect(es).toContain("solo controla su propio camino de envío");
  expect(es).toContain("otras herramientas");
  expect(INSTRUCTIONS).toContain("other tools");
  expect(INSTRUCTIONS.length).toBeLessThanOrEqual(512);
});

test("FR-DRAFTS-02-2: INSTRUCTIONS names approve_draft, the draft number and asking again, inside 512 characters", () => {
  const head = INSTRUCTIONS.slice(0, 512);
  expect(head).toContain("approve_draft");
  expect(head).toContain("draft number");
  expect(head).toContain("ask again");
});
