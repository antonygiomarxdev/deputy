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

export type { ChatExists } from "./ports/chat-exists";
export type { ReadChat } from "./ports/read-chat";
