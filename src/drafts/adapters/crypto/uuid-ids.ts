import type { Ids } from "../../ports/crypto";

export class UuidIds implements Ids {
  next(): string {
    return crypto.randomUUID();
  }
}
