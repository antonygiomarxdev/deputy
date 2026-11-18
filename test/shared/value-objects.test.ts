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

test("lineKey of NI is its e164", () => {
  expect(p("+50588880000").lineKey()).toBe("+50588880000");
});

test("fromInternational normalizes and rejects", () => {
  for (const raw of ["505-88880000", "50588880000", "+505 8888 0000"]) {
    expect(p(raw).digits).toBe("50588880000");
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
