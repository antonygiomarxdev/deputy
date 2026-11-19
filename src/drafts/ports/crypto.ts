export interface TextDigest {
  sha256(text: string): string;
}

export interface Ids {
  next(): string;
}
