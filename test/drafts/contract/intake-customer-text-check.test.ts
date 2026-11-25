// covers: drafts/FRD-02/EX-12
// covers: drafts/FRD-02/EX-13
// covers: drafts/FRD-02/EX-14
import { expect, test } from "bun:test";
import { IntakeCustomerTextCheck } from "../../../src/drafts/adapters/intake/intake-customer-text-check";
import type { IsCustomerText } from "../../../src/intake/index";

const check = (matches: boolean, seen: string[] = []) =>
  new IntakeCustomerTextCheck({
    isCustomerText: {
      execute: async (q) => {
        seen.push(q.text);
        return { matches };
      },
    } satisfies IsCustomerText,
  });

test("FR-DRAFTS-02-6: it returns what Intake's IsCustomerText answers, asking with the owner's words", async () => {
  const seen: string[] = [];
  expect(await check(true, seen).isCustomerText("go 1")).toBe(true);
  expect(await check(false).isCustomerText("go 1")).toBe(false);
  expect(seen).toEqual(["go 1"]);
});
