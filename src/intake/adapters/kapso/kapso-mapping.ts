import type { z } from "zod";
import type { ProviderMessage } from "../../ports/provider";
import type { messageSchema } from "./kapso-schemas";

export type KapsoWireMessage = z.infer<typeof messageSchema>;

/** Kapso's wire message to the provider-neutral shape. The launch gates are fixed here, in one place. */
export function toMessage(m: KapsoWireMessage, conversationRef: string | null): ProviderMessage {
  const outbound = m.kapso.direction === "outbound";
  return {
    providerMessageId: m.id,
    conversationRef: m.kapso.whatsapp_conversation_id ?? conversationRef,
    from: m.from ?? null,
    counterpart: (outbound ? m.to : m.from) ?? null,
    direction: m.kapso.direction,
    type: m.type ?? "unknown",
    text: m.text?.body ?? null,
    transcript: m.kapso.transcript?.text ?? null,
    sentAt: Number(m.timestamp) * 1000,
    origin: m.kapso.origin ?? null,
    group: false, // launch gate: Kapso documents no group marker
    edited: false, // launch gate: Kapso documents no edit flag
    profileName: null, // launch gate: no confirmed Kapso path for the sender profile name
    devOwnerMark: false,
  };
}
