import type { Ids } from "../../ports/outbound";

export class UuidIds implements Ids {
  next(): string {
    return crypto.randomUUID();
  }
}
