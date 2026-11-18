import { expect, test } from "bun:test";
import { compositionTools } from "../../../src/composition/mcp/composition-tools";

function status(d: Parameters<typeof compositionTools>[0]) {
  const tool = compositionTools(d).find((t) => t.name === "status");
  if (tool === undefined) throw new Error("no status tool");
  return tool.run({});
}

test("status shows the mode", async () => {
  expect(await status({ isOwner: () => true, sections: [] })).toMatchObject({ text: "mode: owner", isError: false });
  expect((await status({ isOwner: () => false, sections: [] })).text).toBe("mode: read-only");
});

test("sections follow the mode line in order", async () => {
  const r = await status({ isOwner: () => true, sections: [async () => "a", async () => "b"] });
  expect(r.text).toBe("mode: owner\na\nb");
});

test("a failing section shows unavailable, hides no other and leaks no error text", async () => {
  const r = await status({
    isOwner: () => true,
    sections: [
      async () => "a",
      async () => {
        throw new Error("secret detail");
      },
      async () => "c",
    ],
  });
  expect(r.text).toBe("mode: owner\na\nunavailable\nc");
  expect(r.isError).toBe(false);
});
