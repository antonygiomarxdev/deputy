export class PhoneNumber {
  private constructor(readonly e164: string) {}

  /** 9 digits: Intake TP-04 "unparseable sender"; 15: the E.164 maximum. */
  static fromInternational(raw: string): PhoneNumber | null {
    const cleaned = raw.trim().replace(/[\s\-.()]/g, "");
    if (!/^\+?\d{9,15}$/.test(cleaned)) return null;
    return new PhoneNumber(cleaned.startsWith("+") ? cleaned : `+${cleaned}`);
  }

  get digits(): string {
    return this.e164.slice(1);
  }

  /** Removes the digit WhatsApp inserts (Intake ADR-012). */
  lineKey(): string {
    const d = this.digits;
    if (d.startsWith("549")) return `+54${d.slice(3)}`;
    if (d.startsWith("52") && d.length === 13 && d[2] === "1") return `+52${d.slice(3)}`;
    if (d.startsWith("55") && d.length === 13 && d[4] === "9") return `+55${d.slice(2, 4)}${d.slice(5)}`;
    return this.e164;
  }

  sameLine(other: PhoneNumber): boolean {
    return this.lineKey() === other.lineKey();
  }
}
