import type { Clock } from "../shared/clock";
import type { OwnerLease } from "../shared/owner-lease";
import { ChatExistsUseCase } from "./application/chat-exists";
import { CatchUpUseCase, type CatchUpDeps } from "./application/catch-up";
import { GetSyncStatusUseCase, type GetSyncStatusDeps } from "./application/get-sync-status";
import type { CatchUp } from "./ports/catch-up";
import type { GetSyncStatus } from "./ports/get-sync-status";
import { CheckProviderAccessUseCase } from "./application/check-provider-access";
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
  webhookSecret: string | null;
}

export interface IntakeRuntime {
  receiveLiveDelivery: ReceiveLiveDelivery;
  readChat: ReadChat;
  chatExists: ChatExists;
  isCustomerText: IsCustomerText;
  listChats: ListChats;
  getMessages: GetMessages;
  listRejections: ListRejections;
}

/** Every use case that needs the resolved provider. SPEC-03 and SPEC-04 add theirs. */
export function createIntakeRuntime(d: IntakeRuntimeDeps): IntakeRuntime {
  const store = new StoreMessages({ clock: d.clock });
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
      failures: new StorageFailureLog(),
    }),
    readChat: new ReadChatUseCase(d.repos),
    chatExists: new ChatExistsUseCase({ repos: d.repos, provider: d.provider.name }),
    isCustomerText: new IsCustomerTextUseCase(d.repos),
    listChats: new ListChatsUseCase({ repos: d.repos, provider: d.provider.name }),
    getMessages: new GetMessagesUseCase(d.repos),
    listRejections: new ListRejectionsUseCase(d.repos),
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
