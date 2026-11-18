import { wholeNumberTokens } from "../../shared/text";
import type { DraftNumber } from "./draft";

/** One sentence of the owner's go: 1000 characters is about 150 words, longer than any real go (TP-02 TD-1 step 1). */
export const OWNER_WORDS_MAX = 1000;

export type WordsShape =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "words_empty" | "words_missing_number" };

/** Steps 1 and 2 of OwnerWordsPolicy. Pass number null for an order command (step 2 does not apply). */
export function ownerWordsShape(words: string, number: DraftNumber | null): WordsShape {
  if (words.trim().length === 0 || words.length > OWNER_WORDS_MAX) return { ok: false, code: "words_empty" };
  if (number !== null && !wholeNumberTokens(words).includes(number)) return { ok: false, code: "words_missing_number" };
  return { ok: true };
}
