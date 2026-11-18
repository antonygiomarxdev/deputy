import { describe, expect, test } from "bun:test";
import { MAX_PART, SPLIT_LOOKBACK_UNITS } from "../../../src/intake/domain/constants";
import { splitText } from "../../../src/intake/domain/split-text";

const hasLoneSurrogate = (s: string): boolean => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

describe("splitText", () => {
  test("FR-INTAKE-04-6: 4,000 units are one part, 4,001 are two", () => {
    expect(splitText("a".repeat(MAX_PART))).toHaveLength(1);
    const two = splitText("a".repeat(MAX_PART + 1));
    expect(two.map((p) => p.length)).toEqual([MAX_PART, 1]);
  });

  test("an empty text has no parts", () => {
    expect(splitText("")).toEqual([]);
  });

  test.each([
    ["a family emoji (8 units)", "👨‍👩‍👧‍👦"],
    ["a flag", "🇳🇮"],
    ["an e with a combining accent", "é"],
  ])("%s at the boundary stays whole", (_name, grapheme) => {
    const text = "a".repeat(MAX_PART - 1) + grapheme + "b";
    const parts = splitText(text);
    expect(parts.join("")).toBe(text);
    expect(parts.some((p) => p.includes(grapheme))).toBe(true);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(MAX_PART);
    }
    expect(parts.find((p) => p.includes(grapheme.charAt(0)))?.includes(grapheme)).toBe(true);
  });

  test("no part holds a lone surrogate and joining the parts gives the original, for any cut", () => {
    for (const filler of ["a", "ab", "😀", "é́"]) {
      for (let n = MAX_PART - 6; n < MAX_PART + 6; n++) {
        const text = "x".repeat(n) + filler.repeat(5);
        const parts = splitText(text);
        expect(parts.join("")).toBe(text);
        for (const p of parts) {
          expect(hasLoneSurrogate(p)).toBe(false);
          expect(p.length).toBeLessThanOrEqual(MAX_PART);
        }
      }
    }
  });

  test("a text that exceeds the limit by code units but not by code points is split by code units", () => {
    const text = "😀".repeat(MAX_PART / 2 + 1); // 2,001 code points, 4,002 units
    const parts = splitText(text);
    expect(parts.map((p) => p.length)).toEqual([MAX_PART, 2]);
    expect(parts.join("")).toBe(text);
  });

  test("a space in the last 500 units of the first part is where it is cut, after the space", () => {
    const text = "a".repeat(MAX_PART - 100) + " " + "b".repeat(200);
    const [first, second] = splitText(text);
    expect(first).toBe("a".repeat(MAX_PART - 100) + " ");
    expect(second).toBe("b".repeat(200));
  });

  test("a space that lies before the last 500 units is not used", () => {
    const text = "a".repeat(MAX_PART - SPLIT_LOOKBACK_UNITS - 10) + " " + "b".repeat(SPLIT_LOOKBACK_UNITS + 100);
    const [first] = splitText(text);
    expect(first?.length).toBe(MAX_PART);
  });

  test("one grapheme of 5,000 combining marks is cut at a code point boundary", () => {
    const text = "a" + "́".repeat(4_999);
    const parts = splitText(text);
    expect(parts.map((p) => p.length)).toEqual([MAX_PART, 1_000]);
    expect(parts.join("")).toBe(text);
  });

  test("a hostile grapheme of astral code points is never cut inside a surrogate pair", () => {
    const text = "a" + "\u{1F3FB}".repeat(2_500); // each mark is 2 units: 5,001 units in one grapheme
    const parts = splitText(text);
    expect(parts.join("")).toBe(text);
    for (const p of parts) {
      expect(hasLoneSurrogate(p)).toBe(false);
      expect(p.length).toBeLessThanOrEqual(MAX_PART);
    }
  });

  test("a short text with spaces is one untouched part (no trimming)", () => {
    expect(splitText("  hello \n")).toEqual(["  hello \n"]);
  });
});
