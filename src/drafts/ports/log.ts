import type { ChatId } from "../../shared/chat-id";
import type { LogEntry, NewLogEntry } from "../domain/log-entry";

/** Takes part in the UnitOfWork. */
export interface DraftLogRepository {
  /** Ids in order. Throws LogUnavailable and stores nothing of the batch (it fails the whole transaction). */
  append(entries: NewLogEntry[]): Promise<number[]>;
  /** With `after`: oldest first, ids above it. Otherwise newest first, ids below `before` when given. */
  page(filter: { chat?: ChatId; before?: number; after?: number; limit: number }): Promise<LogEntry[]>;
  /** approval = the entry that sent.approvalEntryId points to. */
  sentWithApproval(): Promise<{ sent: LogEntry; approval: LogEntry | null }[]>;
  stuckDrafts(): Promise<{ draft: number; chat: string; state: "sending" | "unknown"; since: string }[]>;
  /** The one update path. Returns how many entries were scrubbed. */
  scrubOrder(orderId: string, draftNumber: number | null): Promise<number>;
  /** The `approved` entry with that send id. */
  approvalEntryIdFor(sendId: string): Promise<number | null>;
  /** An `order_deleted` entry exists. */
  hasOrderDeleted(orderRef: string): Promise<boolean>;
}
