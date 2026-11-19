import { createHash } from "node:crypto";
import type { TextDigest } from "../../ports/crypto";

export class Sha256Digest implements TextDigest {
  sha256(text: string): string {
    return createHash("sha256").update(text, "utf8").digest("hex");
  }
}
