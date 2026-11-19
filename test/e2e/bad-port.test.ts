import { expect, test, setDefaultTimeout } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { E2E_TIMEOUT_MS } from "../support/harness";

setDefaultTimeout(E2E_TIMEOUT_MS);

const main = join(import.meta.dir, "..", "..", "src", "main.ts");

test.each(["abc", "0", "70000", "80.5", "-1", " 8788", ""])("DEPUTY_PORT=%j is refused at start with a clear message", async (value) => {
  const base = mkdtempSync(join(tmpdir(), "deputy-port-"));
  try {
    const proc = Bun.spawn([process.execPath, main, "serve"], {
      env: {
        ...process.env,
        DEPUTY_DATA_DIR: join(base, "data"),
        DEPUTY_CONFIG_DIR: join(base, "config"),
        DEPUTY_SECRET_SERVICE: `deputy-test-${crypto.randomUUID()}`,
        DEPUTY_PORT: value,
      },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stderr, stdout] = await Promise.all([proc.exited, new Response(proc.stderr).text(), new Response(proc.stdout).text()]);
    expect(code).toBe(1);
    expect(stderr).toContain("DEPUTY_PORT must be a whole number from 1 to 65535");
    expect(stdout).toBe("");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
