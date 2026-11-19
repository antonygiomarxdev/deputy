import type { z } from "zod";
import type { Clock } from "../../../shared/clock";
import type { Instant } from "../../../shared/instant";
import type { PhoneNumber } from "../../../shared/phone-number";
import type { Secret } from "../../domain/secret";
import type { PhoneNumberParser } from "../../ports/phone-number-parser";
import {
  ProviderError,
  REQUEST_TIMEOUT_MS,
  assertLimit,
  toCursor,
  type Cursor,
  type Page,
  type ParsedDelivery,
  type Provider,
  type ProviderConversation,
  type ProviderMessage,
} from "../../ports/provider";
import { KapsoHttp } from "./kapso-http";
import { toMessage } from "./kapso-mapping";
import { KapsoWebhook } from "./kapso-webhook";
import {
  conversationPageSchema,
  messagePageSchema,
  phoneNumberSchema,
  sendResponseSchema,
} from "./kapso-schemas";

export interface KapsoProviderOptions {
  baseUrl: string;
  graphVersion: string;
  apiKey: Secret;
  phoneNumberId: string;
  clock: Clock;
  parser: PhoneNumberParser;
  requestTimeoutMs?: number;
}

export class KapsoProvider implements Provider {
  readonly name = "kapso";
  private readonly http: KapsoHttp;
  private readonly webhook = new KapsoWebhook();

  constructor(private readonly o: KapsoProviderOptions) {
    this.http = new KapsoHttp({ baseUrl: o.baseUrl, apiKey: o.apiKey, clock: o.clock, timeoutMs: o.requestTimeoutMs ?? REQUEST_TIMEOUT_MS });
  }

  async listConversations(
    q: { activeAfter: Instant | null; cursor: Cursor | null; limit: number },
    signal: AbortSignal,
  ): Promise<Page<ProviderConversation>> {
    assertLimit(q.limit);
    const params = this.params({ limit: String(q.limit) }, q.cursor);
    if (q.activeAfter !== null) params.set("last_active_after", new Date(q.activeAfter).toISOString());
    const r = await this.http.request("GET", `/platform/v1/whatsapp/conversations?${params}`, null, signal, false);
    const body = this.parse(conversationPageSchema, r.body);
    const items = body.data.map((c) => {
      const lastActiveAt = Date.parse(c.last_active_at);
      if (Number.isNaN(lastActiveAt)) throw new ProviderError("bad_response", null, false);
      return { ref: c.id, counterpart: c.phone_number ?? null, group: false, lastActiveAt };
    });
    return this.page(items, body.paging, r);
  }

  async listMessages(
    q: { scope: { conversationRef: string } | { outbound: true }; cursor: Cursor | null; limit: number },
    signal: AbortSignal,
  ): Promise<Page<ProviderMessage>> {
    assertLimit(q.limit);
    const scope: Record<string, string> =
      "conversationRef" in q.scope ? { conversation_id: q.scope.conversationRef } : { direction: "outbound" };
    const params = this.params({ ...scope, limit: String(q.limit) }, q.cursor);
    const r = await this.http.request("GET", `/platform/v1/whatsapp/messages?${params}`, null, signal, false);
    const body = this.parse(messagePageSchema, r.body);
    const ref = "conversationRef" in q.scope ? q.scope.conversationRef : null;
    return this.page(
      body.data.map((m) => toMessage(m, ref)),
      body.paging,
      r,
    );
  }

  async sendText(
    req: { to: PhoneNumber; text: string },
    signal: AbortSignal,
  ): Promise<{ providerMessageId: string; serverTime: Instant }> {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: req.to.digits,
      type: "text",
      text: { body: req.text, preview_url: false },
    };
    const path = `/meta/whatsapp/${this.o.graphVersion}/${this.o.phoneNumberId}/messages`;
    const r = await this.http.request("POST", path, payload, signal, true);
    const body = this.parse(sendResponseSchema, r.body);
    return { providerMessageId: body.messages[0]?.id ?? "", serverTime: r.serverTime };
  }

  verifyAndParse(req: {
    rawBody: Uint8Array;
    headers: ReadonlyMap<string, string>;
    secret: string | null;
  }): ParsedDelivery {
    return this.webhook.verifyAndParse(req);
  }

  async businessNumber(signal: AbortSignal): Promise<PhoneNumber | null> {
    const r = await this.http.request("GET", `/platform/v1/whatsapp/phone_numbers/${this.o.phoneNumberId}`, null, signal, false);
    const shown = this.parse(phoneNumberSchema, r.body).data.display_phone_number;
    if (shown === null || shown === undefined) return null;
    const parsed = this.o.parser.parse(shown, null);
    return parsed.ok ? parsed.number : null;
  }

  private params(base: Record<string, string>, cursor: Cursor | null): URLSearchParams {
    const p = new URLSearchParams({ phone_number_id: this.o.phoneNumberId, ...base });
    if (cursor !== null) p.set("after", cursor);
    return p;
  }

  private page<T>(
    items: T[],
    paging: { cursors?: { after?: string | null | undefined } | undefined; next?: string | null | undefined } | undefined,
    r: { serverTime: Instant; remaining: number | null },
  ): Page<T> {
    const after = paging?.cursors?.after;
    const next = paging?.next != null && after != null ? toCursor(after) : null;
    return { items, next, serverTime: r.serverTime, remaining: r.remaining };
  }

  private parse<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
    const r = schema.safeParse(body);
    if (!r.success) throw new ProviderError("bad_response", null, false);
    return r.data;
  }
}
