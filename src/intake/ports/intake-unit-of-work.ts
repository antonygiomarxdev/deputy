import type { ChatStateRepository } from "./chat-state-repository";
import type { MessageRepository } from "./message-repository";
import type { OutgoingRepository } from "./outgoing-repository";
import type { OwnerNumbersRepository } from "./owner-numbers-repository";
import type { PendingChangesReader } from "./pending-changes-reader";
import type { RejectionRepository } from "./rejection-repository";
import type { SyncStateRepository } from "./sync-state-repository";

export interface IntakeRepos {
  messages: MessageRepository;
  chats: ChatStateRepository;
  rejections: RejectionRepository;
  syncState: SyncStateRepository;
  outgoing: OutgoingRepository;
  owners: OwnerNumbersRepository;
  pending: PendingChangesReader;
}

export class LeaseLostError extends Error {}

export interface IntakeUnitOfWork {
  /** One transaction. The SQLite adapter asks OwnerLease.isOwner(tx) first and throws LeaseLostError when it is false. No provider call inside. */
  run<T>(work: (r: IntakeRepos) => Promise<T>): Promise<T>;
}
