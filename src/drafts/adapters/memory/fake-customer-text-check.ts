import { normalizeText } from "../../../shared/text";
import type { CustomerTextCheck } from "../../ports/chat";

/** True when the words equal one of the stored customer texts after normalization, as Intake's IsCustomerText does. */
export class FakeCustomerTextCheck implements CustomerTextCheck {
  onCheck: () => void = () => {};

  constructor(private readonly texts: readonly string[] = []) {}

  async isCustomerText(words: string): Promise<boolean> {
    this.onCheck();
    return this.texts.some((t) => normalizeText(t) === normalizeText(words));
  }
}
