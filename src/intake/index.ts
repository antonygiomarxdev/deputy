import { CatchUpUseCase, type CatchUpDeps } from "./application/catch-up";
import { GetSyncStatusUseCase, type GetSyncStatusDeps } from "./application/get-sync-status";
import type { CatchUp } from "./ports/catch-up";
import type { GetSyncStatus } from "./ports/get-sync-status";
import { CheckProviderAccessUseCase } from "./application/check-provider-access";
import type { CheckProviderAccess } from "./ports/check-provider-access";
import type { Provider } from "./ports/provider";
import { ResolveProviderSettingsUseCase } from "./application/resolve-provider-settings";
import type { IntakeConnectionConfig } from "./ports/intake-connection-config";
import type { OwnerNumbersRepository } from "./ports/owner-numbers-repository";
import type { ResolveProviderSettings } from "./ports/resolve-provider-settings";

export type { ResolvedProvider, ResolveProviderSettings } from "./ports/resolve-provider-settings";
export type { IntakeConnectionConfig } from "./ports/intake-connection-config";
export type { OwnerNumbersRepository } from "./ports/owner-numbers-repository";

export interface IntakeDeps {
  config: IntakeConnectionConfig;
  owners: OwnerNumbersRepository;
}

export function createIntake(deps: IntakeDeps): { resolveProviderSettings: ResolveProviderSettings } {
  return { resolveProviderSettings: new ResolveProviderSettingsUseCase(deps) };
}


export function createCheckProviderAccess(provider: Provider): CheckProviderAccess {
  return new CheckProviderAccessUseCase(provider);
}
export type { CheckProviderAccess, Provider };

export type { CatchUp } from "./ports/catch-up";
export type { GetSyncStatus, SyncStatusView } from "./ports/get-sync-status";
export type { CatchUpFinished } from "./domain/events";
export { RunCoordinator } from "./application/run-coordinator";
export type { CatchUpDeps, RunResult } from "./application/catch-up";
export type { GetSyncStatusDeps } from "./application/get-sync-status";

export function createCatchUp(deps: CatchUpDeps): CatchUp {
  return new CatchUpUseCase(deps);
}

export function createGetSyncStatus(deps: GetSyncStatusDeps): GetSyncStatus {
  return new GetSyncStatusUseCase(deps);
}
export type { ChatExists } from "./ports/chat-exists";
export type { ReadChat } from "./ports/read-chat";
