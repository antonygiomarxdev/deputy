import type { Instant } from "../../shared/instant";

/** Keys in the shared settings table: 'catch_up_minutes' (integer, 1 or more) and 'country' (ISO 3166-1 alpha-2). */
export interface IntakeSettingsRepository {
  /** DEFAULT_PERIOD_MINUTES when absent. */
  getCatchUpMinutes(): Promise<number>;
  setCatchUpMinutes(n: number, at: Instant): Promise<void>;
  getCountry(): Promise<string | null>;
  setCountry(code: string, at: Instant): Promise<void>;
}
