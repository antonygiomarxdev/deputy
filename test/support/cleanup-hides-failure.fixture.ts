// Not a test of its own (the name does not end in .test.ts): harness-cleanup.test.ts runs it in a separate bun process.
import { afterEach, expect, test } from "bun:test";
import { removeHarnessDirs } from "./harness";

afterEach(() => {
  // the folder is busy and stays busy
  removeHarnessDirs(
    { dataDir: "C:/nowhere/deputy-e2e-fixture/data" },
    {
      remove: () => {
        throw new Error("EBUSY: resource busy or locked, rmdir 'deputy.db'");
      },
      attempts: 2,
      delayMs: 1,
    },
  );
});

test("the assertion that fails on purpose", () => {
  expect("the test's own result").toBe("something else");
});
