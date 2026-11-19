import { parseOwnerWords } from "../../shared/owner-words";
import { wholeNumberTokens } from "../../shared/text";
import type { DraftNumber } from "./draft";

export type WordsShape =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "words_empty" | "words_missing_number" };

/** Steps 1 and 2 of OwnerWordsPolicy. Pass number null for an order command (step 2 does not apply). */
export function ownerWordsShape(words: string, number: DraftNumber | null): WordsShape {
  const owned = parseOwnerWords(words);
  if (owned === null) return { ok: false, code: "words_empty" };
  if (number !== null && !wholeNumberTokens(owned).includes(number)) return { ok: false, code: "words_missing_number" };
  return { ok: true };
}
