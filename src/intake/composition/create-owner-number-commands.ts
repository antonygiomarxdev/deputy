import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { ApplyPendingChangesUseCase } from "../application/apply-pending-changes";
import { DescribeNumberUseCase } from "../application/describe-number";
import { GetOwnerNumbersUseCase } from "../application/get-owner-numbers";
import type { ApplyPendingChanges } from "../ports/apply-pending-changes";
import type { DescribeNumber } from "../ports/describe-number";
import type { GetOwnerNumbers } from "../ports/get-owner-numbers";
import type { IntakeSettingsRepository } from "../ports/intake-settings-repository";
import type { IntakeRepos, IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import type { OwnerNumbersRepository } from "../ports/owner-numbers-repository";
import type { PhoneNumberParser } from "../ports/phone-number-parser";

export interface OwnerNumberCommandsDeps {
  repos: IntakeRepos;
  owners: OwnerNumbersRepository;
  unitOfWork: IntakeUnitOfWork;
  parser: PhoneNumberParser;
  settings: Pick<IntakeSettingsRepository, "getCountry">;
  lease: OwnerLease;
  clock: Clock;
}

/**
 * The owner-number commands. They need no provider, and the first one runs before the provider is chosen:
 * a pending business number must be applied before ResolveProviderSettings looks for it.
 */
export function createOwnerNumberCommands(d: OwnerNumberCommandsDeps): {
  applyPendingChanges: ApplyPendingChanges;
  getOwnerNumbers: GetOwnerNumbers;
  describeNumber: DescribeNumber;
} {
  return {
    applyPendingChanges: new ApplyPendingChangesUseCase({ lease: d.lease, unitOfWork: d.unitOfWork, parser: d.parser, settings: d.settings, clock: d.clock }),
    getOwnerNumbers: new GetOwnerNumbersUseCase(d.owners),
    describeNumber: new DescribeNumberUseCase({ parser: d.parser, owners: d.owners, messages: d.repos.messages }),
  };
}
