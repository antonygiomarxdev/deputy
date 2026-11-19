import { CheckProviderAccessUseCase } from "../application/check-provider-access";
import { ResolveProviderSettingsUseCase } from "../application/resolve-provider-settings";
import type { CheckProviderAccess } from "../ports/check-provider-access";
import type { IntakeConnectionConfig } from "../ports/intake-connection-config";
import type { OwnerNumbersRepository } from "../ports/owner-numbers-repository";
import type { Provider } from "../ports/provider";
import type { ResolveProviderSettings } from "../ports/resolve-provider-settings";

export interface IntakeDeps {
  config: IntakeConnectionConfig;
  owners: OwnerNumbersRepository;
}

/** Start-up validation: it runs before any adapter is built, because the provider is its answer. */
export function createIntake(deps: IntakeDeps): { resolveProviderSettings: ResolveProviderSettings } {
  return { resolveProviderSettings: new ResolveProviderSettingsUseCase(deps) };
}

export function createCheckProviderAccess(provider: Provider): CheckProviderAccess {
  return new CheckProviderAccessUseCase(provider);
}
