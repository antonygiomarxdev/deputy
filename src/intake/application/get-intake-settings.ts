import type { GetIntakeSettings } from "../ports/get-intake-settings";
import type { IntakeSettingsRepository } from "../ports/intake-settings-repository";

export class GetIntakeSettingsUseCase implements GetIntakeSettings {
  constructor(private readonly settings: IntakeSettingsRepository) {}

  async execute(): Promise<{ catchUpMinutes: number; country: string | null }> {
    return { catchUpMinutes: await this.settings.getCatchUpMinutes(), country: await this.settings.getCountry() };
  }
}
