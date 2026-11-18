import { str } from "../../../adapters/sqlite/row";
import type { Instant } from "../../../shared/instant";
import type { SqlExecutor } from "../../../shared/sql-database";
import { DEFAULT_PERIOD_MINUTES } from "../../domain/constants";
import type { IntakeSettingsRepository } from "../../ports/intake-settings-repository";

export class SqliteIntakeSettingsRepository implements IntakeSettingsRepository {
  constructor(private readonly ex: SqlExecutor) {}

  async getCatchUpMinutes(): Promise<number> {
    const value = await this.get("catch_up_minutes");
    const n = value === null ? Number.NaN : Number(value);
    return Number.isInteger(n) && n >= 1 ? n : DEFAULT_PERIOD_MINUTES;
  }

  async setCatchUpMinutes(n: number, at: Instant): Promise<void> {
    await this.set("catch_up_minutes", String(n), at);
  }

  getCountry(): Promise<string | null> {
    return this.get("country");
  }

  async setCountry(code: string, at: Instant): Promise<void> {
    await this.set("country", code, at);
  }

  private async get(key: string): Promise<string | null> {
    const [r] = await this.ex.query("SELECT value FROM settings WHERE key = ?", [key]);
    return r === undefined ? null : str(r, "value");
  }

  private async set(key: string, value: string, at: Instant): Promise<void> {
    await this.ex.run(
      `INSERT INTO settings (key, value, changed_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, changed_at = excluded.changed_at`,
      [key, value, at],
    );
  }
}
