import { describe, expect, test } from "bun:test";
import { OWNER_WORDS_MAX } from "../../../src/shared/owner-words";
import { ownerWordsShape } from "../../../src/drafts/domain/owner-words";
import { normalizeText, wholeNumberTokens } from "../../../src/shared/text";

describe("ownerWordsShape", () => {
  test("FR-DRAFTS-02-1: the words name the draft number as a whole token", () => {
    const words = "go on 1 and 3";
    expect(ownerWordsShape(words, 1)).toEqual({ ok: true });
    expect(ownerWordsShape(words, 3)).toEqual({ ok: true });
    expect(ownerWordsShape(words, 2)).toEqual({ ok: false, code: "words_missing_number" });
  });

  test.each(["ok", "yes", "send them"])("FR-DRAFTS-02-2: %p for number 3 is words_missing_number", (words) => {
    expect(ownerWordsShape(words, 3)).toEqual({ ok: false, code: "words_missing_number" });
  });

  test("FR-DRAFTS-02-3: whole-token cases", () => {
    expect(wholeNumberTokens("go on 13")).toEqual([13]);
    expect(ownerWordsShape("go on 13", 1)).toEqual({ ok: false, code: "words_missing_number" });
    expect(ownerWordsShape("go on 13", 3)).toEqual({ ok: false, code: "words_missing_number" });
    expect(wholeNumberTokens("3.5 kilos")).toEqual([]);
    expect(ownerWordsShape("3 kilos", 3)).toEqual({ ok: true });
    expect(ownerWordsShape("وافق على ٣", 3)).toEqual({ ok: true });
    expect(wholeNumberTokens("٣٫٥")).toEqual([]);
    expect(ownerWordsShape("好的，发送３号", 3)).toEqual({ ok: true });
  });

  test("FR-DRAFTS-02-3: 1000 characters are ok, 1001 and only spaces are words_empty", () => {
    const padded = (n: number) => `3${"x".repeat(n - 1)}`;
    expect(OWNER_WORDS_MAX).toBe(1000);
    expect(ownerWordsShape(padded(1000), 3)).toEqual({ ok: true });
    expect(ownerWordsShape(padded(1001), 3)).toEqual({ ok: false, code: "words_empty" });
    expect(ownerWordsShape("     ", 3)).toEqual({ ok: false, code: "words_empty" });
    expect(ownerWordsShape("", null)).toEqual({ ok: false, code: "words_empty" });
  });

  test("a null number (an order command) skips the number check", () => {
    expect(ownerWordsShape("cancel it", null)).toEqual({ ok: true });
  });

  test("the words are trimmed before they are counted, the same for approve, change and reject: 1000 characters with spaces around are ok", () => {
    const padded = (n: number) => `3${"x".repeat(n - 1)}`;
    expect(ownerWordsShape(`${padded(1000)} `, 3)).toEqual({ ok: true });
    expect(ownerWordsShape(`  ${padded(1000)}  `, 3)).toEqual({ ok: true });
    expect(ownerWordsShape(`${padded(1000)}x `, 3)).toEqual({ ok: false, code: "words_empty" });
  });
});

describe("normalizeText", () => {
  test("FR-DRAFTS-02-3: Spanish, Arabic and Chinese punctuation and digits", () => {
    expect(normalizeText("¡Envía el 3!")).toBe(normalizeText("envía el 3"));
    expect(normalizeText("¿Cuánto cuesta?")).toBe("cuánto cuesta");
    expect(wholeNumberTokens("¡Envía el 3!")).toEqual([3]);
    expect(normalizeText("أريد ٣ كيلو")).toBe("أريد 3 كيلو");
    expect(normalizeText("！！好的，我要３个。。")).toBe("好的,我要3个");
  });

  test("FR-DRAFTS-02-6: owner words equal a stored text after normalization", () => {
    expect(normalizeText("¡Hola, Ana!")).toBe(normalizeText("hola, ana"));
  });
});
