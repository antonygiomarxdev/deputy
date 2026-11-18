import { expect, test } from "bun:test";
import { Sha256Digest } from "../../../src/drafts/adapters/crypto/sha256-digest";
import { UuidIds } from "../../../src/drafts/adapters/crypto/uuid-ids";

test("sha256 of the UTF-8 text, as hex", () => {
  const d = new Sha256Digest();
  expect(d.sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(d.sha256("\u00e1")).not.toBe(d.sha256("a"));
});

test("ids are distinct", () => {
  const ids = new UuidIds();
  expect(new Set([ids.next(), ids.next(), ids.next()]).size).toBe(3);
});
