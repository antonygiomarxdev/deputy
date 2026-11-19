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

/** Servers started and not yet closed: a test that timed out may leave one running. */
const live = new Set<Harness>();

/** Closes every server a test started and did not close. The preload runs it after each test. */
export async function closeLeftoverServers(): Promise<void> {
  const left = [...live];
  if (left.length > 0) console.error(`harness closed ${left.length} server(s) a test left running`);
  for (const h of left) await h.close();
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
  const h: Harness = {
    client,
    stderr: () => err,
    protocolErrors,
    dataDir,
    configDir,
    port,
    async close() {
      live.delete(h);
      const t0 = performance.now();
      await transport.close();
      const ms = performance.now() - t0;
      return ms;
    },
  };
  live.add(h);
  return h;
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

/**
 * Waits until the server has acquired the lease and started what it starts when it owns it. Matches the 30 s test timeout
 * in preload.ts: under load a spawned server takes several seconds to reach this line.
 */
export async function waitForOwner(h: Harness, timeoutMs = 30_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (!h.stderr().includes("deputy: owner of")) {
    if (Date.now() > until) throw new Error(`the server never became owner; stderr: ${h.stderr()}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * The dev provider holds an owner's reply from the WhatsApp app, written while Deputy was off (`POST /dev/hold`, `owner: true`).
 * The server finds it with `check_messages`.
 */
export async function holdOwnerReply(h: Harness, r: { chat: string; text: string; sentAt?: number; id?: string }): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${h.port}/dev/hold`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat: r.chat,
      from: r.chat,
      text: r.text,
      owner: true,
      sentAt: r.sentAt ?? Date.now(),
      ...(r.id === undefined ? {} : { providerMessageId: r.id }),
    }),
  });
  if (res.status !== 204) throw new Error(`/dev/hold answered ${res.status}`);
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
