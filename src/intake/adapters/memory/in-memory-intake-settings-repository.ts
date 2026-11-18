import type { Instant } from "../../../shared/instant";
import { DEFAULT_PERIOD_MINUTES } from "../../domain/constants";
import type { IntakeSettingsRepository } from "../../ports/intake-settings-repository";

export class InMemoryIntakeSettingsRepository implements IntakeSettingsRepository {
  private minutes: number | null = null;
  private country: string | null = null;
  /** Test seam: when each key last changed. */
  readonly changedAt = new Map<string, Instant>();

  async getCatchUpMinutes(): Promise<number> {
    return this.minutes ?? DEFAULT_PERIOD_MINUTES;
  }

  async setCatchUpMinutes(n: number, at: Instant): Promise<void> {
    this.minutes = n;
    this.changedAt.set("catch_up_minutes", at);
  }

  async getCountry(): Promise<string | null> {
    return this.country;
  }

  async setCountry(code: string, at: Instant): Promise<void> {
    this.country = code;
    this.changedAt.set("country", at);
  }
}
