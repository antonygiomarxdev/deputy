import { expect, test } from "bun:test";
import { LibphonenumberParser } from "../../../src/intake/adapters/phone/libphonenumber-parser";
import { PhoneNumber } from "../../../src/shared/phone-number";

const parser = new LibphonenumberParser();
const line = (raw: string): PhoneNumber => {
  const n = PhoneNumber.fromInternational(raw);
  if (n === null) throw new Error(raw);
  return n;
};

test("a local AR number with the default country becomes E.164", () => {
  const r = parser.parse("011 15 2345 6789", "AR");
  expect(r.ok && r.number.e164).toBe("+5491123456789");
});

test.each([
  ["+54 11 2345-6789", "5491123456789"],
  ["+52 55 1234 5678", "5215512345678"],
  ["+55 11 8765-4321", "5511987654321"],
])("%s is the same line as %s", (typed, sender) => {
  const r = parser.parse(typed, null);
  expect(r.ok && r.number.sameLine(line(sender))).toBe(true);
});

test("no plus and no country asks for a country code", () => {
  expect(parser.parse("8888 0000", null)).toEqual({ ok: false, invalid: "needs_country_code" });
});

test("a number of impossible length is unparseable (isPossible), as is a stub like +54 1", () => {
  expect(parser.parse("+1 1234567890123", null)).toEqual({ ok: false, invalid: "unparseable" });
  expect(parser.parse("+54 1", null)).toEqual({ ok: false, invalid: "unparseable" });
});

test("text without a number is unparseable", () => {
  expect(parser.parse("abc", null)).toEqual({ ok: false, invalid: "unparseable" });
});

test("isCountry knows ISO codes", () => {
  expect(parser.isCountry("NI")).toBe(true);
  expect(parser.isCountry("XX")).toBe(false);
});
