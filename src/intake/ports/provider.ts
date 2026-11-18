import type { Instant } from "../../shared/instant";
import type { PhoneNumber } from "../../shared/phone-number";
import type { ProviderName } from "../../shared/provider-name";

/** A listing is one HTTP call, normally under a second (Intake TP-03 "Constants"). */
export const REQUEST_TIMEOUT_MS = 15_000;
export { MAX_PART } from "../domain/constants";

export type Cursor = string & { readonly __cursor: true };

/** The one place a string becomes a Cursor: adapters build cursors they own the format of. */
export function toCursor(s: string): Cursor {
  return s as Cursor;
}

export interface Page<T> {
  items: readonly T[]; // newest first
  next: Cursor | null; // null: the listing is exhausted
  serverTime: Instant; // provider clock, from the response Date header
  remaining: number | null; // requests left in the current window, null if unknown
}

export interface ProviderConversation {
  ref: string;
  counterpart: string | null;
  group: boolean;
  lastActiveAt: Instant;
}

export interface ProviderMessage {
  providerMessageId: string | null; // null only in a live delivery that lacks it
  conversationRef: string | null;
  from: string | null;
  counterpart: string | null;
  direction: "inbound" | "outbound";
  type: string; // "unknown" when absent
  text: string | null;
  transcript: string | null;
  sentAt: Instant;
  origin: string | null; // kapso.origin, kept as information (FR-INTAKE-04-12)
  group: boolean;
  edited: boolean;
  profileName: string | null; // untrusted customer text
  devOwnerMark: boolean; // true only from the dev adapter
}

export type ProviderEvent =
  | { kind: "message"; message: ProviderMessage }
  | { kind: "edit"; providerMessageId: string; text: string }
  | { kind: "delete"; providerMessageId: string }
  | { kind: "ignored"; reason: "reaction" | "receipt" };

export type ParsedDelivery =
  | { kind: "ok"; events: readonly ProviderEvent[] }
  | { kind: "no_secret" }
  | { kind: "missing_signature" }
  | { kind: "bad_signature" }
  | { kind: "malformed" };

export type ProviderErrorKind =
  | "unreachable"
  | "credentials"
  | "quota"
  | "rate_limited"
  | "timeout"
  | "bad_response";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly retryAfterMs: number | null, // set for rate_limited
    readonly mayHaveBeenAccepted: boolean, // false for a refusal; true for a timeout or dropped connection on a send
  ) {
    super(kind);
  }
}

export interface Provider {
  readonly name: ProviderName;
  listConversations(
    q: { activeAfter: Instant | null; cursor: Cursor | null; limit: number },
    signal: AbortSignal,
  ): Promise<Page<ProviderConversation>>;
  listMessages(
    q: { scope: { conversationRef: string } | { outbound: true }; cursor: Cursor | null; limit: number },
    signal: AbortSignal,
  ): Promise<Page<ProviderMessage>>;
  /** One part of at most `MAX_PART` UTF-16 code units. The caller splits. */
  sendText(
    req: { to: PhoneNumber; text: string },
    signal: AbortSignal,
  ): Promise<{ providerMessageId: string; serverTime: Instant }>;
  verifyAndParse(req: {
    rawBody: Uint8Array;
    headers: ReadonlyMap<string, string>; // names lower-cased
    secret: string | null;
  }): ParsedDelivery;
  /** The connected business number, when the provider offers it; null otherwise. */
  businessNumber(signal: AbortSignal): Promise<PhoneNumber | null>;
}

/** A caller bug, not an expected failure: every listing asks for at least one item. */
export function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`limit must be a whole number of 1 or more, got ${limit}`);
}
