import { expect, test } from "bun:test";
import { inspect } from "node:util";
import { Secret } from "../../../src/intake/domain/secret";

test("a Secret shows [secret] everywhere and reveals its value on request", () => {
  const s = new Secret("hunter2");
  expect(String(s)).toBe("[secret]");
  expect(JSON.stringify({ s })).toBe('{"s":"[secret]"}');
  expect(inspect(s)).toBe("[secret]");
  expect(s.reveal()).toBe("hunter2");
});
