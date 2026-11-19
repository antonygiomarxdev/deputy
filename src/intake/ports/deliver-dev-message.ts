import type { Instant } from "../../shared/instant";

/** What a tester sends: the same fields as the dev delivery format. `owner: true` marks an owner reply; `history: true` a history message. */
export interface DevMessageInput {
  chat: string;
  from: string;
  text: string;
  type?: string;
  transcript?: string | null;
  sentAt?: Instant;
  owner?: boolean;
  history?: boolean;
  providerMessageId?: string;
}

/** The dev entry point: used by the `/dev/deliver` route and by Setup's test mode. Not an MCP tool. */
export interface DeliverDevMessage {
  execute(q: DevMessageInput): Promise<
    | { ok: true; result: "stored" | "duplicate" }
    | { ok: false; reason: "not_dev" | "invalid_chat" | "invalid_from" | "storage_failed" }
  >;
}

/** What the dev provider adapter gives the use case: the delivery held at the provider's side, signed as the provider would. */
export interface DevDeliverySource {
  /** Copies the message into what the dev provider holds; the id is the one the delivery carries. */
  signedDelivery(q: DevMessageInput): Promise<{ rawBody: Uint8Array; headers: ReadonlyMap<string, string> }>;
}
