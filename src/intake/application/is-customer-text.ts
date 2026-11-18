import { normalizeText } from "../../shared/text";
import type { IsCustomerText } from "../ports/is-customer-text";
import type { IntakeRepos } from "../ports/intake-unit-of-work";

export class IsCustomerTextUseCase implements IsCustomerText {
  constructor(private readonly repos: Pick<IntakeRepos, "messages">) {}

  async execute(q: { text: string }): Promise<{ matches: boolean }> {
    const norm = normalizeText(q.text);
    // Text that normalizes to nothing says nothing about who wrote it.
    return { matches: norm !== "" && (await this.repos.messages.hasCustomerTextNorm(norm)) };
  }
}
