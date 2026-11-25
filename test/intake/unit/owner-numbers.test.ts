import { expect, test } from "bun:test";
import { OwnerNumbers, type OwnerNumberEntry } from "../../../src/intake/domain/owner-numbers";
import { PhoneNumber } from "../../../src/shared/phone-number";

function phone(raw: string): PhoneNumber {
  const n = PhoneNumber.fromInternational(raw);
  if (n === null) throw new Error(raw);
  return n;
}
const entry = (raw: string, kind: "business" | "extra"): OwnerNumberEntry => ({
  number: phone(raw),
  kind,
  label: "",
  addedAt: 1,
});

test("has is true for the business number and the extra, false for a third", () => {
  const o = OwnerNumbers.empty();
  o.add(entry("+12125550100", "business"));
  o.add(entry("+12125550102", "extra"));
  expect(o.has(phone("+12125550100"))).toBe(true);
  expect(o.has(phone("+12125550102"))).toBe(true);
  expect(o.has(phone("+12125550108"))).toBe(false);
  expect(o.has(null)).toBe(false);
});

test("a second business number is refused", () => {
  const o = OwnerNumbers.empty();
  o.add(entry("+12125550100", "business"));
  expect(o.add(entry("+12125550108", "business"))).toEqual({ ok: false, reason: "second_business" });
});

test("the same line twice is a duplicate", () => {
  const o = OwnerNumbers.empty();
  o.add(entry("+5491123456789", "extra"));
  expect(o.add(entry("+541123456789", "extra"))).toEqual({ ok: false, reason: "duplicate" });
});

test("removing an absent number is not_present; removing a present one works", () => {
  const o = OwnerNumbers.empty();
  expect(o.remove(phone("+12125550100"))).toEqual({ ok: false, reason: "not_present" });
  o.add(entry("+12125550100", "extra"));
  expect(o.remove(phone("+12125550100"))).toEqual({ ok: true });
  expect(o.entries()).toEqual([]);
});

test("an empty set is valid and has nobody", () => {
  const o = OwnerNumbers.empty();
  expect(o.has(phone("+12125550100"))).toBe(false);
  expect(o.business()).toBeNull();
});
