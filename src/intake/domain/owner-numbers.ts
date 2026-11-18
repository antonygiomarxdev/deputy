import type { Instant } from "../../shared/instant";
import type { PhoneNumber } from "../../shared/phone-number";

export type OwnerNumberKind = "business" | "extra";

export interface OwnerNumberEntry {
  readonly number: PhoneNumber;
  readonly kind: OwnerNumberKind;
  readonly label: string;
  readonly addedAt: Instant;
}

export interface OwnerNumberLogEntry {
  readonly at: Instant;
  readonly action: "add" | "remove";
  readonly number: string;
  readonly kind: OwnerNumberKind;
  readonly label: string;
  readonly command: string;
}

export type OwnerNumbersChange =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "second_business" | "not_present" };

export class OwnerNumbers {
  private constructor(private items: OwnerNumberEntry[]) {}

  static empty(): OwnerNumbers {
    return new OwnerNumbers([]);
  }

  static of(entries: readonly OwnerNumberEntry[]): OwnerNumbers {
    return new OwnerNumbers([...entries]);
  }

  entries(): readonly OwnerNumberEntry[] {
    return this.items;
  }

  has(sender: PhoneNumber | null): boolean {
    return sender !== null && this.items.some((e) => e.number.sameLine(sender));
  }

  business(): OwnerNumberEntry | null {
    return this.items.find((e) => e.kind === "business") ?? null;
  }

  add(e: OwnerNumberEntry): OwnerNumbersChange {
    if (this.has(e.number)) return { ok: false, reason: "duplicate" };
    if (e.kind === "business" && this.business() !== null) return { ok: false, reason: "second_business" };
    this.items = [...this.items, e];
    return { ok: true };
  }

  remove(n: PhoneNumber): OwnerNumbersChange {
    if (!this.has(n)) return { ok: false, reason: "not_present" };
    this.items = this.items.filter((e) => !e.number.sameLine(n));
    return { ok: true };
  }
}
