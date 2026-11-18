import type { PhoneNumber } from "../../shared/phone-number";

export type PhoneParseResult =
  | { ok: true; number: PhoneNumber }
  | { ok: false; invalid: "unparseable" | "needs_country_code" };

export interface PhoneNumberParser {
  parse(text: string, defaultCountry: string | null): PhoneParseResult;
  /** ISO 3166-1 alpha-2. */
  isCountry(code: string): boolean;
}
