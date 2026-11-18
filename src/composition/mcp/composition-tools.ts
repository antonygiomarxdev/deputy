import { defineTool, type ToolDefinition } from "../../adapters/mcp/tool";

export function compositionTools(d: {
  isOwner(): boolean;
  /** One line each; a failing section shows as "unavailable" and never hides the others. */
  sections: readonly (() => Promise<string>)[];
}): ToolDefinition[] {
  const status = defineTool({
    name: "status",
    description: "Show whether this Deputy is the owner process or read-only, then one line per part of the system.",
    input: {},
    async run() {
      const lines = [`mode: ${d.isOwner() ? "owner" : "read-only"}`];
      for (const section of d.sections) {
        try {
          lines.push(await section());
        } catch {
          lines.push("unavailable");
        }
      }
      return { text: lines.join("\n"), structured: { lines }, isError: false };
    },
  });
  return [status];
}
