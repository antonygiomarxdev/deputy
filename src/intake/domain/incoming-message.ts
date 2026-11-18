import type { Instant } from "../../shared/instant";

/** What `Message.receive` and `chatOf` read of a provider message. `ProviderMessage` (ports/provider.ts) satisfies it; the domain owns its input (ADR-000). */
export interface IncomingMessage {
  readonly providerMessageId: string | null;
  readonly conversationRef: string | null;
  readonly from: string | null;
  readonly counterpart: string | null;
  readonly direction: "inbound" | "outbound";
  readonly type: string;
  readonly text: string | null;
  readonly transcript: string | null;
  readonly sentAt: Instant;
  readonly origin: string | null;
  readonly group: boolean;
  readonly edited: boolean;
  readonly devOwnerMark: boolean;
}
