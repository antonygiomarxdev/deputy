import { Database } from "bun:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closedPort } from "./fake-kapso-server";

const root = join(import.meta.dir, "..", "..");

export interface Harness {
  client: Client;
  /** Everything the server wrote to stderr so far. */
  stderr(): string;
  /** Errors the client saw on the wire, for example a stdout line that was not an MCP frame. */
  protocolErrors: Error[];
  dataDir: string;
  configDir: string;
  /** The loopback port the live listener uses (DEPUTY_PORT). */
  port: number;
  /** Closes stdin and waits for the process; returns how long that took in ms. */
  close(): Promise<number>;
}

/** `reuse` starts the server again on the folders of an earlier run (for example after seeding the database). */
export async function startServer(
  env: Record<string, string> = {},
  reuse?: { dataDir: string; configDir: string },
): Promise<Harness> {
  const base = reuse === undefined ? mkdtempSync(join(tmpdir(), "deputy-e2e-")) : null;
  const dataDir = reuse?.dataDir ?? join(base ?? "", "data");
  const configDir = reuse?.configDir ?? join(base ?? "", "config");
  mkdirSync(configDir, { recursive: true });
  const port = Number(env["DEPUTY_PORT"] ?? (await closedPort()));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, "src", "main.ts"), "serve"],
    env: { DEPUTY_DATA_DIR: dataDir, DEPUTY_CONFIG_DIR: configDir, DEPUTY_PORT: String(port), DEPUTY_SECRET_SERVICE: `deputy-test-${crypto.randomUUID()}`, ...env },
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
    port,
    async close() {
      const t0 = performance.now();
      await transport.close();
      const ms = performance.now() - t0;
      return ms;
    },
  };
}

/**
 * Removes the folders a server used. It never throws: on Windows a data file can stay busy for a moment after the process
 * ends (EBUSY), and a cleanup error thrown from afterEach would hide the assertion that failed in the test. It retries, and when
 * the folder will not go it says so on stderr and leaves it, so the test's own failure is what gets reported.
 */
export function removeHarnessDirs(
  h: Pick<Harness, "dataDir">,
  o: { remove?: (path: string) => void; attempts?: number; delayMs?: number } = {},
): void {
  const remove = o.remove ?? ((p: string) => rmSync(p, { recursive: true, force: true }));
  const attempts = o.attempts ?? 10;
  const path = join(h.dataDir, "..");
  for (let i = 1; ; i++) {
    try {
      remove(path);
      return;
    } catch (e) {
      if (i >= attempts) {
        console.error(`harness cleanup left ${path} behind after ${attempts} tries: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      Bun.sleepSync(o.delayMs ?? 100);
    }
  }
}

export function writeConfig(dir: string, obj: Record<string, unknown>): void {
  writeFileSync(join(dir, "config.json"), JSON.stringify(obj));
}

export async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

/** Waits until the server has acquired the lease and started what it starts when it owns it. */
export async function waitForOwner(h: Harness, timeoutMs = 5_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (!h.stderr().includes("deputy: owner of")) {
    if (Date.now() > until) throw new Error(`the server never became owner; stderr: ${h.stderr()}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * What `/dev/hold` will do (SPEC-01 Task 12): the dev provider holds an owner's reply from the WhatsApp app, written while
 * Deputy was off. The server finds it with `check_messages`.
 */
export function holdOwnerReply(h: Harness, r: { chat: string; text: string; sentAt?: number; id?: string }): void {
  const db = new Database(join(h.dataDir, "deputy.db"));
  try {
    db.run(
      `INSERT INTO dev_holdings (provider_message_id, conversation_ref, counterpart, sender, direction, type, text, origin, sent_at, owner_mark)
       VALUES (?, ?, ?, NULL, 'outbound', 'text', ?, 'business_app', ?, 1)`,
      [r.id ?? `dev-out-held-${crypto.randomUUID()}`, `dev:${r.chat}`, r.chat, r.text, r.sentAt ?? Date.now()],
    );
  } finally {
    db.close();
  }
}

/** What `deputy config` writes: a row the running server applies under its lease. */
export function insertPendingChange(h: Harness, key: "owner_numbers" | "business_number" | "owner_number_remove", value: string, command: string): void {
  const db = new Database(join(h.dataDir, "deputy.db"));
  try {
    db.run("INSERT INTO pending_changes (key, value, command, at) VALUES (?, ?, ?, ?)", [key, value, command, Date.now()]);
  } finally {
    db.close();
  }
}
