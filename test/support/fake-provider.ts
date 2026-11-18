import type { Instant } from "../../src/shared/instant";
import type { PhoneNumber } from "../../src/shared/phone-number";
import type { ProviderName } from "../../src/shared/provider-name";
import type {
  Cursor,
  Page,
  ParsedDelivery,
  Provider,
  ProviderConversation,
  ProviderMessage,
} from "../../src/intake/ports/provider";

export type ListCall =
  | { kind: "conversations"; activeAfter: Instant | null; cursor: Cursor | null }
  | { kind: "messages"; scope: { conversationRef: string } | { outbound: true }; cursor: Cursor | null };

/**
 * A scripted Provider. `verifyAndParse` answers `parsed`. Listings are served from the scripted data, newest first, in pages of
 * `pageSize` with offset cursors, and every call is recorded. Sending is not scripted.
 */
export class FakeProvider implements Provider {
  parsed: ParsedDelivery = { kind: "malformed" };
  readonly verifyCalls: Array<{ rawBody: Uint8Array; headers: ReadonlyMap<string, string>; secret: string | null }> = [];

  /** The provider clock, as `serverTime` of every listing. */
  serverTime: Instant = 0;
  pageSize = 100;
  conversations: ProviderConversation[] = [];
  /** Messages by conversation ref, any order; the fake sorts newest first. */
  messages = new Map<string, ProviderMessage[]>();
  outbound: ProviderMessage[] = [];
  readonly calls: ListCall[] = [];
  /** Runs at the start of every listing; a throw fails that call (scripted errors). */
  onCall: ((c: ListCall) => void | Promise<void>) | null = null;

  constructor(readonly name: ProviderName = "kapso") {}

  verifyAndParse(req: { rawBody: Uint8Array; headers: ReadonlyMap<string, string>; secret: string | null }): ParsedDelivery {
    this.verifyCalls.push(req);
    return this.parsed;
  }

  deliver(...messages: ProviderMessage[]): void {
    this.parsed = { kind: "ok", events: messages.map((message) => ({ kind: "message", message })) };
  }

  /** Holds a conversation with its messages; `lastActiveAt` is the newest message time unless given. */
  hold(ref: string, counterpart: string, messages: ProviderMessage[], lastActiveAt?: Instant): void {
    this.messages.set(ref, messages);
    const newest = Math.max(...messages.map((m) => m.sentAt));
    this.conversations = [
      ...this.conversations.filter((c) => c.ref !== ref),
      { ref, counterpart, group: false, lastActiveAt: lastActiveAt ?? newest },
    ];
  }

  private page<T>(sorted: readonly T[], cursor: Cursor | null): Page<T> {
    const offset = cursor === null ? 0 : Number(cursor);
    const items = sorted.slice(offset, offset + this.pageSize);
    const more = offset + this.pageSize < sorted.length;
    // the cursor is this fake's own offset string
    return { items, next: more ? (String(offset + this.pageSize) as Cursor) : null, serverTime: this.serverTime, remaining: null };
  }

  async listConversations(
    q: { activeAfter: Instant | null; cursor: Cursor | null; limit: number },
    _signal: AbortSignal,
  ): Promise<Page<ProviderConversation>> {
    const call: ListCall = { kind: "conversations", activeAfter: q.activeAfter, cursor: q.cursor };
    this.calls.push(call);
    await this.onCall?.(call);
    const active = this.conversations
      .filter((c) => q.activeAfter === null || c.lastActiveAt >= q.activeAfter)
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    return this.page(active, q.cursor);
  }

  async listMessages(
    q: { scope: { conversationRef: string } | { outbound: true }; cursor: Cursor | null; limit: number },
    _signal: AbortSignal,
  ): Promise<Page<ProviderMessage>> {
    const call: ListCall = { kind: "messages", scope: q.scope, cursor: q.cursor };
    this.calls.push(call);
    await this.onCall?.(call);
    const all = "outbound" in q.scope ? this.outbound : (this.messages.get(q.scope.conversationRef) ?? []);
    return this.page([...all].sort((a, b) => b.sentAt - a.sentAt), q.cursor);
  }

  /** Every sendText call. */
  readonly sent: Array<{ to: PhoneNumber; text: string }> = [];
  /** One entry per call, in order: a result, or an error to throw. When it runs out, a send succeeds with an id of its own. */
  sendScript: Array<{ providerMessageId: string; serverTime: Instant } | Error> = [];

  async sendText(req: { to: PhoneNumber; text: string }, _s: AbortSignal): Promise<{ providerMessageId: string; serverTime: Instant }> {
    this.sent.push(req);
    const next = this.sendScript.shift();
    if (next instanceof Error) throw next;
    return next ?? { providerMessageId: `wamid.SENT${this.sent.length}`, serverTime: this.serverTime };
  }

  businessNumber(): Promise<PhoneNumber | null> {
    return Promise.resolve(null);
  }
}
