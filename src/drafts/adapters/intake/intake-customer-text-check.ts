import type { IsCustomerText } from "../../../intake/index";
import type { CustomerTextCheck } from "../../ports/chat";

/** Does the owner's text equal a stored customer message, in any chat? Intake answers; Drafts only asks. */
export class IntakeCustomerTextCheck implements CustomerTextCheck {
  constructor(private readonly intake: { isCustomerText: IsCustomerText }) {}

  async isCustomerText(words: string): Promise<boolean> {
    return (await this.intake.isCustomerText.execute({ text: words })).matches;
  }
}
