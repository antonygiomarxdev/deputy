import { Message, type ReceiveContext } from "../../src/intake/domain/message";
import { OwnerNumbers } from "../../src/intake/domain/owner-numbers";
import type { ProviderMessage } from "../../src/intake/ports/provider";

export function providerMessage(over: Partial<ProviderMessage> = {}): ProviderMessage {
  return {
    providerMessageId: "m1",
    conversationRef: "conv-1",
    from: "5491123456789",
    counterpart: "5491123456789",
    direction: "inbound",
    type: "text",
    text: "hello",
    transcript: null,
    sentAt: 1_000,
    origin: null,
    group: false,
    edited: false,
    profileName: null,
    devOwnerMark: false,
    ...over,
  };
}

export function receiveContext(over: Partial<ReceiveContext> = {}): ReceiveContext {
  return { provider: "kapso", owners: OwnerNumbers.empty(), matchesSend: false, connectedAt: null, now: 5_000, ...over };
}

export function receive(over: Partial<ProviderMessage> = {}, ctx: Partial<ReceiveContext> = {}): Message {
  const m = Message.receive(providerMessage(over), receiveContext(ctx));
  if (!(m instanceof Message)) throw new Error("fixture message was rejected");
  return m;
}
