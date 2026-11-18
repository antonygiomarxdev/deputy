import { GetIntakeSettingsUseCase } from "./application/get-intake-settings";
import { SetIntakeSettingsUseCase, type SetIntakeSettingsDeps } from "./application/set-intake-settings";
import type { GetIntakeSettings } from "./ports/get-intake-settings";
import type { IntakeSettingsRepository } from "./ports/intake-settings-repository";
import type { SetIntakeSettings } from "./ports/set-intake-settings";
import type { Clock } from "../shared/clock";
import type { OwnerLease } from "../shared/owner-lease";
import { ChatExistsUseCase } from "./application/chat-exists";
import { CatchUpUseCase, type CatchUpDeps, type RunResult } from "./application/catch-up";
import { RunCoordinator } from "./application/run-coordinator";
import { GetSyncStatusUseCase, type GetSyncStatusDeps } from "./application/get-sync-status";
import type { CatchUp } from "./ports/catch-up";
import type { GetSyncStatus } from "./ports/get-sync-status";
import { CheckProviderAccessUseCase } from "./application/check-provider-access";
import type { Secret } from "./domain/secret";
import { ApplyPendingChangesUseCase } from "./application/apply-pending-changes";
import { DescribeNumberUseCase } from "./application/describe-number";
import { GetOwnerNumbersUseCase } from "./application/get-owner-numbers";
import { FindOutgoingUseCase } from "./application/find-outgoing";
import { MarkInterruptedSendsUseCase } from "./application/mark-interrupted-sends";
import { SendTextUseCase } from "./application/send-text";
import { GetMessagesUseCase } from "./application/get-messages";
import { IsCustomerTextUseCase } from "./application/is-customer-text";
import { ListChatsUseCase } from "./application/list-chats";
import { ListRejectionsUseCase } from "./application/list-rejections";
import { ReadChatUseCase } from "./application/read-chat";
import { ReceiveLiveDeliveryUseCase } from "./application/receive-live-delivery";
import { ResolveProviderSettingsUseCase } from "./application/resolve-provider-settings";
import { StorageFailureLog } from "./application/storage-failure-log";
import { StoreMessages } from "./application/store-messages";
import type { CheckProviderAccess } from "./ports/check-provider-access";
import type { ChatExists } from "./ports/chat-exists";
import type { EventPublisher } from "./ports/event-publisher";
import type { ApplyPendingChanges } from "./ports/apply-pending-changes";
import type { DescribeNumber } from "./ports/describe-number";
import type { GetOwnerNumbers } from "./ports/get-owner-numbers";
import type { PhoneNumberParser } from "./ports/phone-number-parser";
import type { FindOutgoing } from "./ports/find-outgoing";
import type { MarkInterruptedSends } from "./ports/mark-interrupted-sends";
import type { SendText } from "./ports/send-text";
import type { GetMessages } from "./ports/get-messages";
import type { IntakeConnectionConfig } from "./ports/intake-connection-config";
import type { IntakeRepos, IntakeUnitOfWork } from "./ports/intake-unit-of-work";
import type { IsCustomerText } from "./ports/is-customer-text";
import type { ListChats } from "./ports/list-chats";
import type { ListRejections } from "./ports/list-rejections";
import type { OwnerNumbersRepository } from "./ports/owner-numbers-repository";
import type { Provider } from "./ports/provider";
import type { ReadChat } from "./ports/read-chat";
import type { ReceiveLiveDelivery } from "./ports/receive-live-delivery";
import type { ResolveProviderSettings } from "./ports/resolve-provider-settings";

export type { ResolvedProvider, ResolveProviderSettings } from "./ports/resolve-provider-settings";
export type { IntakeConnectionConfig } from "./ports/intake-connection-config";
export type { OwnerNumbersRepository } from "./ports/owner-numbers-repository";
export type { IntakeEvent, MessageStored } from "./domain/events";
export type { EventPublisher } from "./ports/event-publisher";
export type { ReceiveLiveDelivery } from "./ports/receive-live-delivery";
export type { ListRejections } from "./ports/list-rejections";
export type { ReadChat } from "./ports/read-chat";
export type { SendText, SendTextResult } from "./ports/send-text";
export type { FindOutgoing, FindOutgoingResult } from "./ports/find-outgoing";
export type { MarkInterruptedSends } from "./ports/mark-interrupted-sends";
export type { ApplyPendingChanges } from "./ports/apply-pending-changes";
export type { DescribeNumber } from "./ports/describe-number";
export type { GetOwnerNumbers, OwnerNumbersView } from "./ports/get-owner-numbers";
export type { ChatExists } from "./ports/chat-exists";
export type { IsCustomerText } from "./ports/is-customer-text";
export type { ListChats } from "./ports/list-chats";
export type { GetMessages } from "./ports/get-messages";
export type { ChatStateView, ChatView, MessageView } from "./ports/views";
export type { CheckProviderAccess, Provider };

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

export interface IntakeRuntimeDeps {
  /** Plain repositories for the pure reads (no transaction, no lease). */
  repos: IntakeRepos;
  unitOfWork: IntakeUnitOfWork;
  events: EventPublisher;
  clock: Clock;
  lease: OwnerLease;
  provider: Provider;
  receiving: "catch_up" | "live";
  webhookSecret: Secret | null;
  settings: IntakeSettingsRepository;
}

export interface IntakeRuntime {
  receiveLiveDelivery: ReceiveLiveDelivery;
  readChat: ReadChat;
  chatExists: ChatExists;
  isCustomerText: IsCustomerText;
  listChats: ListChats;
  getMessages: GetMessages;
  listRejections: ListRejections;
  catchUp: CatchUp;
  getSyncStatus: GetSyncStatus;
  getIntakeSettings: GetIntakeSettings;
  sendText: SendText;
  findOutgoing: FindOutgoing;
  markInterruptedSends: MarkInterruptedSends;
}

/** Every use case that needs the resolved provider. SPEC-03 and SPEC-04 add theirs. */
export function createIntakeRuntime(d: IntakeRuntimeDeps): IntakeRuntime {
  const store = new StoreMessages({ clock: d.clock });
  // one failure log and one coordinator: the status view reads what live delivery and catch-up record
  const failures = new StorageFailureLog();
  const coordinator = new RunCoordinator<RunResult>(d.clock);
  const getSyncStatus = new GetSyncStatusUseCase({
    provider: d.provider.name,
    reads: d.repos,
    settings: d.settings,
    coordinator,
    failures,
    clock: d.clock,
  });
  return {
    receiveLiveDelivery: new ReceiveLiveDeliveryUseCase({
      lease: d.lease,
      provider: d.provider,
      receiving: d.receiving,
      webhookSecret: d.webhookSecret,
      unitOfWork: d.unitOfWork,
      store,
      events: d.events,
      clock: d.clock,
      failures,
    }),
    readChat: new ReadChatUseCase(d.repos),
    chatExists: new ChatExistsUseCase({ repos: d.repos, provider: d.provider.name }),
    isCustomerText: new IsCustomerTextUseCase(d.repos),
    listChats: new ListChatsUseCase({ repos: d.repos, provider: d.provider.name }),
    getMessages: new GetMessagesUseCase(d.repos),
    listRejections: new ListRejectionsUseCase(d.repos),
    catchUp: new CatchUpUseCase({
      provider: d.provider,
      clock: d.clock,
      lease: d.lease,
      uow: d.unitOfWork,
      reads: d.repos,
      store,
      publisher: d.events,
      coordinator,
      status: getSyncStatus,
      failures,
    }),
    getSyncStatus,
    getIntakeSettings: new GetIntakeSettingsUseCase(d.settings),
    sendText: new SendTextUseCase({ lease: d.lease, provider: d.provider, unitOfWork: d.unitOfWork, store, clock: d.clock }),
    findOutgoing: new FindOutgoingUseCase({ lease: d.lease, unitOfWork: d.unitOfWork, clock: d.clock }),
    markInterruptedSends: new MarkInterruptedSendsUseCase({ lease: d.lease, unitOfWork: d.unitOfWork }),
  };
}

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

export type { GetIntakeSettings } from "./ports/get-intake-settings";
export type { SetIntakeSettings } from "./ports/set-intake-settings";
export type { SetIntakeSettingsDeps } from "./application/set-intake-settings";

export function createGetIntakeSettings(settings: IntakeSettingsRepository): GetIntakeSettings {
  return new GetIntakeSettingsUseCase(settings);
}

export function createSetIntakeSettings(deps: SetIntakeSettingsDeps): SetIntakeSettings {
  return new SetIntakeSettingsUseCase(deps);
}

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
