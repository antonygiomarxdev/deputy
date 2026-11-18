const DIGIT = /\p{Nd}/u;
const SEPARATOR = /[.,٫٬]/;

// Each \p{Nd} digit becomes its ASCII digit: its distance from the first code point of its contiguous run of Nd code points, modulo ten.
function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    let first = cp;
    while (DIGIT.test(String.fromCodePoint(first - 1))) first--;
    return String((cp - first) % 10);
  });
}

export function normalizeText(text: string): string {
  const folded = asciiDigits(text.normalize("NFKC").toLowerCase());
  return folded.replace(/\s+/gu, " ").replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "");
}

export function wholeNumberTokens(words: string): number[] {
  const s = asciiDigits(words);
  const out: number[] = [];
  for (const m of s.matchAll(/\d+/g)) {
    const start = m.index;
    const end = start + m[0].length;
    const before = start >= 2 && SEPARATOR.test(s[start - 1] ?? "") && /\d/.test(s[start - 2] ?? "");
    const after = SEPARATOR.test(s[end] ?? "") && /\d/.test(s[end + 1] ?? "");
    if (!before && !after) out.push(Number(m[0]));
  }
  return out;
}

export function foldName(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/([\p{sc=Latin}\p{sc=Greek}\p{sc=Cyrillic}\p{sc=Arabic}\p{sc=Hebrew}])\p{M}+/gu, "$1")
    .normalize("NFC");
}
