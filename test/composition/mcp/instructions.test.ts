import { expect, test } from "bun:test";
import { z } from "zod";
import { defineTool } from "../../../src/adapters/mcp/tool";
import { INSTRUCTIONS } from "../../../src/composition/mcp/instructions";

test("INSTRUCTIONS fits in 512 characters and its first 512 hold the rules", () => {
  expect(INSTRUCTIONS.length).toBeLessThanOrEqual(512);
  const head = INSTRUCTIONS.slice(0, 512);
  for (const word of ["approve_draft", "data", "draft number", "language"]) expect(head).toContain(word);
});

test("defineTool rejects bad args without calling the handler", async () => {
  let called = false;
  const tool = defineTool({
    name: "t",
    description: "d",
    input: { n: z.number() },
    async run() {
      called = true;
      return { text: "ok", structured: {}, isError: false };
    },
  });
  const bad = await tool.run({ n: "x" });
  expect(bad.isError).toBe(true);
  expect(called).toBe(false);
  expect((await tool.run({ n: 1 })).isError).toBe(false);
  expect(called).toBe(true);
});
