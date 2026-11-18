import type { Instant } from "../../src/shared/instant";
import type { PhoneNumber } from "../../src/shared/phone-number";
import type { ProviderName } from "../../src/shared/provider-name";
import type { Cursor, Page, ParsedDelivery, Provider, ProviderConversation, ProviderMessage } from "../../src/intake/ports/provider";

/** A scripted Provider: `verifyAndParse` answers `parsed` and records what it was given; the rest is not scripted. */
export class FakeProvider implements Provider {
  parsed: ParsedDelivery = { kind: "malformed" };
  readonly verifyCalls: Array<{ rawBody: Uint8Array; headers: ReadonlyMap<string, string>; secret: string | null }> = [];

  constructor(readonly name: ProviderName = "kapso") {}

  verifyAndParse(req: { rawBody: Uint8Array; headers: ReadonlyMap<string, string>; secret: string | null }): ParsedDelivery {
    this.verifyCalls.push(req);
    return this.parsed;
  }

  deliver(...messages: ProviderMessage[]): void {
    this.parsed = { kind: "ok", events: messages.map((message) => ({ kind: "message", message })) };
  }

  listConversations(_q: { activeAfter: Instant | null; cursor: Cursor | null; limit: number }, _s: AbortSignal): Promise<Page<ProviderConversation>> {
    return Promise.reject(new Error("FakeProvider: listConversations is not scripted"));
  }

  listMessages(): Promise<Page<ProviderMessage>> {
    return Promise.reject(new Error("FakeProvider: listMessages is not scripted"));
  }

  sendText(_req: { to: PhoneNumber; text: string }, _s: AbortSignal): Promise<{ providerMessageId: string; serverTime: Instant }> {
    return Promise.reject(new Error("FakeProvider: sendText is not scripted"));
  }

  businessNumber(): Promise<PhoneNumber | null> {
    return Promise.resolve(null);
  }
}
