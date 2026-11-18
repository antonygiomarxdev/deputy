import { getCountries, parsePhoneNumberFromString } from "libphonenumber-js";
import { PhoneNumber } from "../../../shared/phone-number";
import type { PhoneNumberParser, PhoneParseResult } from "../../ports/phone-number-parser";

export class LibphonenumberParser implements PhoneNumberParser {
  parse(text: string, defaultCountry: string | null): PhoneParseResult {
    const country = defaultCountry === null ? undefined : getCountries().find((c) => c === defaultCountry);
    if (defaultCountry !== null && country === undefined) return { ok: false, invalid: "unparseable" };
    if (!text.trim().startsWith("+") && country === undefined && /\d/.test(text)) {
      return { ok: false, invalid: "needs_country_code" };
    }
    const parsed = parsePhoneNumberFromString(text, country);
    if (parsed === undefined || !parsed.isPossible()) return { ok: false, invalid: "unparseable" };
    const number = PhoneNumber.fromInternational(parsed.number);
    return number === null ? { ok: false, invalid: "unparseable" } : { ok: true, number };
  }

  isCountry(code: string): boolean {
    return getCountries().some((c) => c === code);
  }
}
