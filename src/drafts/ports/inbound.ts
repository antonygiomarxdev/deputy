import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { AuditDefect, AuditGap } from "../domain/approval-audit";
import type { LogKind } from "../domain/log-entry";
import type { DraftKind, DraftNumber, DraftState } from "../domain/draft";
import type { Refusal } from "../domain/refusals";
import type { OrderChangeInput, OrderInput } from "./outbound";

export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly refusal: Refusal };

export type MessageView = {
  id: string;
  sentAt: string;
  text: string;
  source: "customer" | "owner_app" | "sent_through_deputy";
};

export interface CreateDraft {
  run(
    input: { kind: "reply"; chat: string; text: string } | { kind: "order"; chat: string; order: OrderInput },
  ): Promise<Outcome<CreateDraftResult>>;
}
export type CreateDraftResult = {
  number: number;
  kind: DraftKind;
  state: "waiting";
  chat: ChatId;
  madeAt: Instant;
  text: string; // exactly what would be sent (order: Orders' summary)
  answers: MessageView | null;
  replaced: { number: number; state: "waiting" | "held" | "failed" } | null;
};

export interface ListDrafts {
  run(input: { chat?: string }): Promise<Outcome<DraftView[]>>;
}
export type DraftView = {
  number: DraftNumber;
  kind: DraftKind;
  chat: string;
  state: DraftState;
  text: string;
  madeAt: string;
  answers: MessageView | { unavailable: true } | null;
  catalogChanged: boolean; // orders only; replies are marked by the MCP adapter
  holdReason: string | null;
  failReason: string | null;
  fromEarlierSession: boolean; // madeAt is before sessionStartedAt (D25)
  retryAt: string | null; // SPEC-03
};

export interface ChangeDraft {
  run(input: { number: number; text?: string; order?: OrderInput; ownerWords: string }): Promise<Outcome<ChangeDraftResult>>;
}
export type ChangeDraftResult = { number: number; state: "waiting"; approvalVoided: boolean };

export interface RejectDraft {
  run(input: { number: number; ownerWords: string }): Promise<Outcome<{ number: number; state: "rejected" }>>;
}

/** A pure read: no lease check. "sending" and "recording" are reported as "waiting". No draft text is returned. */
export interface WaitingChats {
  run(): Promise<WaitingChat[]>;
}
export type WaitingChat = {
  number: number;
  kind: DraftKind;
  chat: string;
  writtenAt: string;
  state: "waiting" | "held" | "failed" | "unknown";
  earlierSession: boolean;
};

export interface ApproveDraft {
  run(input: { number: number; shownText: string; ownerWords: string }): Promise<Outcome<ApproveResult>>;
}
export type ApproveResult =
  | { outcome: "sent"; number: number; sendId: string; logged: boolean }
  | { outcome: "recorded"; number: number; orderId: string }
  | { outcome: "failed"; number: number; reason: string }
  | { outcome: "unknown"; number: number; reason: string; detail: string };
// SPEC-03 adds "held" and "queued".

export interface ApproveOrderCommand {
  run(
    input:
      | { command: "change"; orderRef: string; change: OrderChangeInput; ownerWords: string }
      | { command: "delete"; orderRef: string; confirm: boolean; ownerWords: string },
  ): Promise<
    Outcome<
      | { approved: true; logEntryId: number; result: { ok: true; detail: string } | { ok: false; reason: string } }
      | { approved: false; pendingDelete: string }
    >
  >;
}

export type LogEntryView = {
  id: number;
  at: string;
  kind: LogKind;
  draft: number | null;
  chat: string;
  proposedText: string | null;
  finalText: string | null;
  reason: string | null;
  ownerWords: string | null;
  scrubbed: boolean;
  /** The customer message the draft answered. Set only on `approved` and `rejected` entries of a reply draft; an id, not text. */
  answersMessageId: string | null;
};

export interface ReadDraftLog {
  /**
   * limit 1 to 100, default 20 (ADR-009). Without `after`: newest first, entries with id < before. With `after`: oldest first,
   * entries with id > after. `nextBefore` is the id of the oldest shown entry when older ones exist. A pure read, no lease check.
   */
  run(input: { chat?: string; limit?: number; before?: number; after?: number }): Promise<Outcome<{ entries: LogEntryView[]; nextBefore: number | null }>>;
}

export interface CheckApprovals {
  /** A pure read. */
  run(): Promise<{ defects: AuditDefect[]; gaps: AuditGap[] }>;
}

/**
 * Orders' OrderDeleted, delivered through its outbox. `draftNumber` is null when the order is not from this data folder.
 * Idempotence is keyed by the order id, not the event id: any later delivery for an order already scrubbed returns `scrubbed: 0`.
 */
export interface OnOrderDeleted {
  run(event: { eventId: string; orderId: string; draftNumber: number | null; chat: string }): Promise<{ scrubbed: number } | { refused: "not_owner" }>;
}

export interface RetryPendingOutcomes {
  run(): Promise<{ written: number; pending: number }>;
}
