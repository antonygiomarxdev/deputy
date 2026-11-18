import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");

export interface Harness {
  client: Client;
  /** Everything the server wrote to stderr so far. */
  stderr(): string;
  /** Errors the client saw on the wire, for example a stdout line that was not an MCP frame. */
  protocolErrors: Error[];
  dataDir: string;
  configDir: string;
  /** Closes stdin and waits for the process; returns how long that took in ms. */
  close(): Promise<number>;
}

export async function startServer(env: Record<string, string> = {}): Promise<Harness> {
  const base = mkdtempSync(join(tmpdir(), "deputy-e2e-"));
  const dataDir = join(base, "data");
  const configDir = join(base, "config");
  mkdirSync(configDir, { recursive: true });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, "src", "main.ts"), "serve"],
    env: { DEPUTY_DATA_DIR: dataDir, DEPUTY_CONFIG_DIR: configDir, ...env },
    stderr: "pipe",
  });
  let err = "";
  transport.stderr?.on("data", (b: Buffer) => (err += b.toString()));
  const client = new Client({ name: "harness", version: "0" });
  const protocolErrors: Error[] = [];
  client.onerror = (e) => protocolErrors.push(e);
  await client.connect(transport);
  return {
    client,
    stderr: () => err,
    protocolErrors,
    dataDir,
    configDir,
    async close() {
      const t0 = performance.now();
      await transport.close();
      const ms = performance.now() - t0;
      return ms;
    },
  };
}

export function removeHarnessDirs(h: Harness): void {
  rmSync(join(h.dataDir, ".."), { recursive: true, force: true });
}

export function writeConfig(dir: string, obj: Record<string, unknown>): void {
  writeFileSync(join(dir, "config.json"), JSON.stringify(obj));
}

export async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}
