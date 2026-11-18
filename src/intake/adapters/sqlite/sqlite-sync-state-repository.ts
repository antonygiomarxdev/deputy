import { numOrNull } from "../../../adapters/sqlite/row";
import type { Instant } from "../../../shared/instant";
import type { ProviderName } from "../../../shared/provider-name";
import type { SqlExecutor } from "../../../shared/sql-database";
import type { SyncStateRepository } from "../../ports/sync-state-repository";

export class SqliteSyncStateRepository implements SyncStateRepository {
  constructor(private readonly ex: SqlExecutor) {}

  async connectedAt(provider: ProviderName): Promise<Instant | null> {
    return this.column(provider, "connected_at");
  }

  // A live delivery before the first catch-up creates the row as failed with no reason (SPEC-02, Context 4).
  async markLiveVerified(provider: ProviderName, at: Instant): Promise<void> {
    await this.ex.run(
      `INSERT INTO catchup_status (provider, status, live_verified_at) VALUES (?, 'failed', ?)
       ON CONFLICT (provider) DO UPDATE SET live_verified_at = excluded.live_verified_at`,
      [provider, at],
    );
  }

  async liveVerifiedAt(provider: ProviderName): Promise<Instant | null> {
    return this.column(provider, "live_verified_at");
  }

  private async column(provider: ProviderName, name: "connected_at" | "live_verified_at"): Promise<Instant | null> {
    const [r] = await this.ex.query(`SELECT ${name} AS v FROM catchup_status WHERE provider = ?`, [provider]);
    return r === undefined ? null : numOrNull(r, "v");
  }
}
