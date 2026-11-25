import { expect, test } from "bun:test";
import { PhoneNumber } from "../../src/shared/phone-number";
import { parseChatId } from "../../src/shared/chat-id";
import { parseSendId } from "../../src/shared/send-id";
import { parseOwnerWords } from "../../src/shared/owner-words";
import { FakeClock } from "../support/fake-clock";

const p = (s: string): PhoneNumber => {
  const n = PhoneNumber.fromInternational(s);
  if (!n) throw new Error(`bad ${s}`);
  return n;
};

test("sameLine: AR, MX, BR pairs", () => {
  expect(p("+5491123456789").sameLine(p("+541123456789"))).toBe(true);
  expect(p("+5491123456789").sameLine(p("+5491123456780"))).toBe(false);
  expect(p("+5215512345678").sameLine(p("+525512345678"))).toBe(true);
  expect(p("+5511987654321").sameLine(p("+551187654321"))).toBe(true);
});

test("lineKey of US is its e164", () => {
  expect(p("+12125550100").lineKey()).toBe("+12125550100");
});

test("fromInternational normalizes and rejects", () => {
  for (const raw of ["1-212-555-0100", "12125550100", "+1 212 555 0100"]) {
    expect(p(raw).digits).toBe("12125550100");
  }
  for (const raw of ["12345678", "1234567890123456", "abc12345678"]) {
    expect(PhoneNumber.fromInternational(raw)).toBeNull();
  }
});

test("parsers", () => {
  expect(parseChatId("   ")).toBeNull();
  expect(parseSendId("x".repeat(100))).not.toBeNull();
  expect(parseSendId("x".repeat(101))).toBeNull();
  expect(String(parseOwnerWords("  ok  "))).toBe("ok");
  expect(parseOwnerWords("")).toBeNull();
  expect(parseOwnerWords("x".repeat(1001))).toBeNull();
});

test("FakeClock resolves a pending sleep on advance", async () => {
  const clock = new FakeClock(1000);
  let done = false;
  void clock.sleep(500).then(() => (done = true));
  await clock.advance(500);
  expect(done).toBe(true);
  expect(clock.now()).toBe(1500);
});
