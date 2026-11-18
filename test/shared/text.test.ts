import { describe, expect, test } from "bun:test";
import { foldName, normalizeText, wholeNumberTokens } from "../../src/shared/text";

describe("normalizeText", () => {
  test.each([
    ["¡Hola, Ana!", "hola, ana"],
    ["¿Cuánto cuesta?", "cuánto cuesta"],
    ["أريد ٣ كيلو", "أريد 3 كيلو"],
    ["！！好的，我要３个。。", "好的,我要3个"],
    ["ok 👍", "ok"],
  ])("%s", (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });

  test("case, whitespace runs and edge punctuation do not matter; inner punctuation stays", () => {
    expect(normalizeText("  Hello   WORLD!! ")).toBe(normalizeText("hello world"));
    expect(normalizeText("a.b, c")).toBe("a.b, c");
  });
});

describe("wholeNumberTokens", () => {
  test.each([
    ["go on 1 and 3", [1, 3]],
    ["13", [13]],
    ["3.5", []],
    ["٣", [3]],
    ["3 kilos", [3]],
  ])("%s", (input, expected) => {
    expect(wholeNumberTokens(input)).toEqual(expected);
  });
});

describe("foldName", () => {
  test("drops marks on Latin, Arabic and Hebrew letters", () => {
    expect(foldName("Piña")).toBe("pina");
    expect(foldName("María")).toBe("maria");
    expect(foldName("كَتَبَ")).toBe("كتب");
    expect(foldName("שָׁלוֹם")).toBe("שלום");
  });

  test("keeps Devanagari marks", () => {
    expect(foldName("कि")).toBe("कि");
  });
});
