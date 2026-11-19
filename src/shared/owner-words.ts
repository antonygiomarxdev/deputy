/** The owner's words, trimmed, count 1 to this many characters: one sentence of the go (TP-02 TD-1 step 1). */
export const OWNER_WORDS_MAX = 1000;

export type OwnerWords = string & { readonly __ownerWords: true };

export function parseOwnerWords(raw: string): OwnerWords | null {
  const t = raw.trim();
  return t.length >= 1 && t.length <= OWNER_WORDS_MAX ? (t as OwnerWords) : null;
}
