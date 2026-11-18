import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { DraftKind, DraftNumber } from "./draft";

export type LogKind =
  | "proposed"
  | "replaced"
  | "text_changed"
  | "approved"
  | "approval_voided"
  | "rejected"
  | "held"
  | "owner_choice"
  | "sending"
  | "sent"
  | "failed"
  | "unknown"
  | "recorded"
  | "order_command"
  | "order_deleted";

export interface NewLogEntry {
  readonly at: Instant;
  readonly kind: LogKind;
  readonly draft: DraftNumber | null;
  readonly draftKind: DraftKind | null;
  readonly chat: ChatId;
  readonly proposedText: string | null; // null for order drafts (the schema enforces it)
  readonly finalText: string | null; // null for order drafts
  readonly reason: string | null;
  readonly ownerWords: string | null;
  readonly approvalEntryId: number | null; // id of the `approved` entry of the attempt
  readonly sendId: string | null;
  readonly orderRef: string | null; // an order id, never a name or an address
}

export interface LogEntry extends NewLogEntry {
  readonly id: number;
  readonly scrubbed: boolean;
}
