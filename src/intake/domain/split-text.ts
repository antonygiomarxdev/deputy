import { MAX_PART, SPLIT_LOOKBACK_UNITS } from "./constants";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const isSpace = (g: string): boolean => /^\s+$/u.test(g);

/** One grapheme longer than MAX_PART (hostile combining marks): cut at code point boundaries, never inside a surrogate pair. */
function cutGrapheme(g: string): string[] {
  const chunks: string[] = [];
  let chunk = "";
  for (const cp of g) {
    if (chunk.length + cp.length > MAX_PART) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += cp;
  }
  if (chunk !== "") chunks.push(chunk);
  return chunks;
}

/**
 * Parts of at most MAX_PART UTF-16 code units, cut at grapheme boundaries and, when a space lies in the last
 * SPLIT_LOOKBACK_UNITS of a part, after that space. No part is trimmed: joining them gives the original text.
 */
export function splitText(text: string): string[] {
  const parts: string[] = [];
  let current: string[] = [];
  let units = 0;

  const cut = (): void => {
    let at = -1;
    let offset = units;
    for (let i = current.length - 1; i >= 0; i--) {
      const g = current[i] ?? "";
      offset -= g.length;
      if (offset < units - SPLIT_LOOKBACK_UNITS) break;
      if (isSpace(g)) {
        at = i;
        break;
      }
    }
    const head = at === -1 ? current : current.slice(0, at + 1);
    const rest = at === -1 ? [] : current.slice(at + 1);
    parts.push(head.join(""));
    current = rest;
    units = rest.reduce((n, g) => n + g.length, 0);
  };

  for (const { segment: g } of segmenter.segment(text)) {
    if (g.length > MAX_PART) {
      if (current.length > 0) {
        parts.push(current.join(""));
        current = [];
        units = 0;
      }
      const chunks = cutGrapheme(g);
      parts.push(...chunks.slice(0, -1));
      const last = chunks.at(-1) ?? "";
      current = [last];
      units = last.length;
      continue;
    }
    while (current.length > 0 && units + g.length > MAX_PART) cut();
    current.push(g);
    units += g.length;
  }
  if (current.length > 0) parts.push(current.join(""));
  return parts;
}
