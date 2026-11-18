import type { PhoneNumberParser, PhoneParseResult } from "../../ports/phone-number-parser";

/** Table-driven fake: the key is the exact text; an unknown text is `unparseable`. */
export class InMemoryPhoneNumberParser implements PhoneNumberParser {
  constructor(
    private readonly table: Readonly<Record<string, PhoneParseResult>>,
    private readonly countries: readonly string[] = [],
  ) {}

  parse(text: string): PhoneParseResult {
    return this.table[text] ?? { ok: false, invalid: "unparseable" };
  }

  isCountry(code: string): boolean {
    return this.countries.includes(code);
  }
}
