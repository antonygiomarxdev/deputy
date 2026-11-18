export type OwnerWords = string & { readonly __ownerWords: true };

export function parseOwnerWords(raw: string): OwnerWords | null {
  const t = raw.trim();
  return t.length >= 1 && t.length <= 1000 ? (t as OwnerWords) : null;
}
