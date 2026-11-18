import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ToolDefinition } from "../../adapters/mcp/tool";

export interface McpServerDeps {
  name: string;
  version: string;
  instructions: string;
  tools: readonly ToolDefinition[];
  claudeChannel: boolean;
}

export function createMcpServer(d: McpServerDeps): { connectStdio(): Promise<void>; close(): Promise<void> } {
  const server = new Server(
    { name: d.name, version: d.version },
    {
      capabilities: { tools: {}, ...(d.claudeChannel ? { experimental: { "claude/channel": {} } } : {}) },
      instructions: d.instructions,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: d.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: { ...z.toJSONSchema(z.object(t.input)), type: "object" as const },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = d.tools.find((t) => t.name === req.params.name);
    if (tool === undefined) {
      return { content: [{ type: "text" as const, text: `unknown tool ${req.params.name}` }], isError: true };
    }
    const r = await tool.run(req.params.arguments ?? {});
    return { content: [{ type: "text" as const, text: r.text }], structuredContent: { ...r.structured }, isError: r.isError };
  });

  return {
    connectStdio: () => server.connect(new StdioServerTransport()),
    close: () => server.close(),
  };
}
