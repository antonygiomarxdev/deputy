import type { ChatId } from "../../shared/chat-id";
import type { OrderField } from "../domain/order-fields";

export type OrderInput = Readonly<Record<string, unknown>>; // validated by Orders' PrepareOrder

/** Drafts owns this port; the adapter calls Orders' PrepareOrder and revalidate. */
export interface OrderPreparer {
  prepare(
    chat: ChatId,
    order: OrderInput,
  ): Promise<{ ok: true; payload: string; summary: string } | { ok: false; reasons: string[] }>;
  revalidate(payload: string): Promise<{ catalogChanged: boolean }>;
}

/** Drafts owns this port; the adapter calls Orders' RecordOrder. Idempotent on draftNumber. */
export interface OrderRecorder {
  record(input: { draftNumber: number; payload: string; ownerWords: string }): Promise<
    | { ok: true; orderId: string }
    | { ok: false; kind: "outcome_unknown" }
    | { ok: false; kind: "refused"; reason: string }
  >;
}

export type OrderChangeInput = Readonly<Partial<Record<OrderField, unknown>>>;

/** Drafts owns this port; the adapter calls Orders' ChangeOrder and DeleteOrder. */
export interface OrderChanger {
  /**
   * The chat id of the order, and nothing else (no name, no address, no customer text): it goes into the log entry,
   * which is written before the command is called. null when the order is unknown.
   */
  chatOf(orderRef: string): Promise<string | null>;
  change(orderRef: string, change: OrderChangeInput, ownerWords: string): Promise<{ ok: true; detail: string } | { ok: false; reason: string }>;
  delete(
    orderRef: string,
    ownerWords: string,
    confirm: boolean,
  ): Promise<{ ok: true; detail: string } | { ok: false; reason: string } | { pending: string }>;
}
