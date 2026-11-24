import { expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { join } from "node:path";
import { E2E_TIMEOUT_MS, removeHarnessDirs } from "./harness";

setDefaultTimeout(E2E_TIMEOUT_MS);

const h = { dataDir: join("C:", "tmp", "deputy-e2e-x", "data") };

test("a busy folder is retried and removed when it frees up", () => {
  let calls = 0;
  removeHarnessDirs(h, {
    remove: () => {
      if (++calls < 3) throw new Error("EBUSY");
    },
    delayMs: 1,
  });
  expect(calls).toBe(3);
});

test("a folder that never frees up is reported on stderr and never thrown", () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  let calls = 0;
  expect(() =>
    removeHarnessDirs(h, {
      remove: () => {
        calls++;
        throw new Error("EBUSY: resource busy or locked");
      },
      attempts: 4,
      delayMs: 1,
    }),
  ).not.toThrow();
  const lines = log.mock.calls.map((c) => String(c[0]));
  log.mockRestore();
  expect(calls).toBe(4);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain("left");
  expect(lines[0]).toContain("EBUSY");
});

test("FR harness: when a test fails and its cleanup fails too, the report shows the test's assertion", async () => {
  const proc = Bun.spawn([process.execPath, "test", join(import.meta.dir, "cleanup-hides-failure.fixture.ts")], {
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
  const [code, out, err] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const report = out + err;
  expect(code).not.toBe(0);
  expect(report).toContain("the assertion that fails on purpose");
  expect(report).toContain("something else"); // the expected value of the failing assertion
  expect(report).toContain("harness cleanup left"); // and the cleanup error is reported too, after it
  expect(report).not.toContain("error: EBUSY"); // as a thrown error it would have replaced the assertion
});
