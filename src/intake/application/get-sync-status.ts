import type { Clock } from "../../shared/clock";
import type { ProviderName } from "../../shared/provider-name";
import type { GetSyncStatus, SyncStatusView } from "../ports/get-sync-status";
import type { IntakeSettingsRepository } from "../ports/intake-settings-repository";
import type { IntakeRepos } from "../ports/intake-unit-of-work";
import type { RunCoordinator } from "./run-coordinator";
import type { StorageFailureLog } from "./storage-failure-log";
import { buildSyncStatusView } from "./status-view";

export interface GetSyncStatusDeps {
  provider: ProviderName;
  /** Reads outside any transaction. */
  reads: Pick<IntakeRepos, "syncState" | "messages">;
  settings: IntakeSettingsRepository;
  coordinator: Pick<RunCoordinator, "running">;
  failures: StorageFailureLog;
  clock: Clock;
}

export class GetSyncStatusUseCase implements GetSyncStatus {
  constructor(private readonly d: GetSyncStatusDeps) {}

  async execute(): Promise<SyncStatusView> {
    const { provider, reads } = this.d;
    return buildSyncStatusView({
      provider,
      state: await reads.syncState.load(provider),
      running: this.d.coordinator.running,
      newestStoredAt: await reads.messages.newestStoredAt(provider),
      oldestStoredAt: await reads.messages.oldestStoredAt(provider),
      catchUpMinutes: await this.d.settings.getCatchUpMinutes(),
      storageFailureAt: this.d.failures.last(),
      now: this.d.clock.now(),
    });
  }
}
