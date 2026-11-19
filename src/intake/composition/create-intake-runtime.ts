import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { ChatExistsUseCase } from "../application/chat-exists";
import { CatchUpUseCase, type RunResult } from "../application/catch-up";
import { CatchUpChatUseCase } from "../application/catch-up-chat";
import { DeliverDevMessageUseCase } from "../application/deliver-dev-message";
import { FindOutgoingUseCase } from "../application/find-outgoing";
import { GetIntakeSettingsUseCase } from "../application/get-intake-settings";
import { GetMessagesUseCase } from "../application/get-messages";
import { GetSyncStatusUseCase } from "../application/get-sync-status";
import { IsCustomerTextUseCase } from "../application/is-customer-text";
import { ListChatsUseCase } from "../application/list-chats";
import { ListRejectionsUseCase } from "../application/list-rejections";
import { MarkInterruptedSendsUseCase } from "../application/mark-interrupted-sends";
import { ReadChatUseCase } from "../application/read-chat";
import { ReceiveLiveDeliveryUseCase } from "../application/receive-live-delivery";
import { RunCoordinator } from "../application/run-coordinator";
import { SendTextUseCase } from "../application/send-text";
import { StorageFailureLog } from "../application/storage-failure-log";
import { StoreMessages } from "../application/store-messages";
import type { Secret } from "../domain/secret";
import type { CatchUp } from "../ports/catch-up";
import type { CatchUpChat } from "../ports/catch-up-chat";
import type { ChatExists } from "../ports/chat-exists";
import type { DevDeliverySource } from "../ports/deliver-dev-message";
import type { EventPublisher } from "../ports/event-publisher";
import type { FindOutgoing } from "../ports/find-outgoing";
import type { GetIntakeSettings } from "../ports/get-intake-settings";
import type { GetMessages } from "../ports/get-messages";
import type { GetSyncStatus } from "../ports/get-sync-status";
import type { IntakeSettingsRepository } from "../ports/intake-settings-repository";
import type { IntakeRepos, IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import type { IsCustomerText } from "../ports/is-customer-text";
import type { ListChats } from "../ports/list-chats";
import type { ListRejections } from "../ports/list-rejections";
import type { MarkInterruptedSends } from "../ports/mark-interrupted-sends";
import type { Provider } from "../ports/provider";
import type { ReadChat } from "../ports/read-chat";
import type { ReceiveLiveDelivery } from "../ports/receive-live-delivery";
import type { SendText } from "../ports/send-text";

export interface IntakeRuntimeDeps {
  /** Plain repositories for the pure reads (no transaction, no lease). */
  repos: IntakeRepos;
  unitOfWork: IntakeUnitOfWork;
  events: EventPublisher;
  clock: Clock;
  lease: OwnerLease;
  provider: Provider;
  /** The resolved receiving mode; dev ignores it (dev entry points are always on). */
  receiving: "catch_up" | "live";
  /** The Kapso webhook secret, or null when none is configured. */
  webhookSecret: Secret | null;
  settings: IntakeSettingsRepository;
  /** What the dev provider can hold and sign; null under Kapso. */
  devDeliveries: DevDeliverySource | null;
}

export interface IntakeRuntime {
  deliverDevMessage: DeliverDevMessageUseCase;
  receiveLiveDelivery: ReceiveLiveDelivery;
  readChat: ReadChat;
  chatExists: ChatExists;
  isCustomerText: IsCustomerText;
  listChats: ListChats;
  getMessages: GetMessages;
  listRejections: ListRejections;
  catchUp: CatchUp;
  catchUpChat: CatchUpChat;
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
  const receiveLiveDelivery = new ReceiveLiveDeliveryUseCase({
    lease: d.lease,
    provider: d.provider,
    receiving: d.receiving,
    webhookSecret: d.webhookSecret,
    unitOfWork: d.unitOfWork,
    store,
    events: d.events,
    clock: d.clock,
    failures,
  });
  return {
    receiveLiveDelivery,
    deliverDevMessage: new DeliverDevMessageUseCase({
      provider: d.provider.name,
      source: d.devDeliveries,
      receive: receiveLiveDelivery,
      unitOfWork: d.unitOfWork,
      clock: d.clock,
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
    catchUpChat: new CatchUpChatUseCase({
      provider: d.provider,
      clock: d.clock,
      lease: d.lease,
      uow: d.unitOfWork,
      reads: d.repos,
      store,
      publisher: d.events,
      coordinator,
    }),
    getSyncStatus,
    getIntakeSettings: new GetIntakeSettingsUseCase(d.settings),
    sendText: new SendTextUseCase({ lease: d.lease, provider: d.provider, unitOfWork: d.unitOfWork, store, clock: d.clock }),
    findOutgoing: new FindOutgoingUseCase({ lease: d.lease, unitOfWork: d.unitOfWork, clock: d.clock }),
    markInterruptedSends: new MarkInterruptedSendsUseCase({ lease: d.lease, unitOfWork: d.unitOfWork }),
  };
}
