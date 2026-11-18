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
  type ProviderEvent,
  type ProviderMessage,
} from "../../ports/provider";
import { verifyHmacSha256Hex } from "../hmac";
import { Pacer } from "./pacer";
import {
  conversationPageSchema,
  liveDeliverySchema,
  messagePageSchema,
  messageSchema,
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

type Raw = z.infer<typeof messageSchema>;

const SIGNATURE_HEADER = "x-webhook-signature";
const EVENT_HEADER = "x-webhook-event";

function toMessage(m: Raw, conversationRef: string | null): ProviderMessage {
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

export class KapsoProvider implements Provider {
  readonly name = "kapso";
  private readonly timeoutMs: number;
  private readonly ignoredEvents = new Map<string, number>();
  private readonly pacer: Pacer;

  constructor(private readonly o: KapsoProviderOptions) {
    this.timeoutMs = o.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
    this.pacer = new Pacer(o.clock);
  }

  async listConversations(
    q: { activeAfter: Instant | null; cursor: Cursor | null; limit: number },
    signal: AbortSignal,
  ): Promise<Page<ProviderConversation>> {
    assertLimit(q.limit);
    const params = this.params({ limit: String(q.limit) }, q.cursor);
    if (q.activeAfter !== null) params.set("last_active_after", new Date(q.activeAfter).toISOString());
    const r = await this.request("GET", `/platform/v1/whatsapp/conversations?${params}`, null, signal, false);
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
    const r = await this.request("GET", `/platform/v1/whatsapp/messages?${params}`, null, signal, false);
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
    const r = await this.request("POST", path, payload, signal, true);
    const body = this.parse(sendResponseSchema, r.body);
    return { providerMessageId: body.messages[0]?.id ?? "", serverTime: r.serverTime };
  }

  verifyAndParse(req: {
    rawBody: Uint8Array;
    headers: ReadonlyMap<string, string>;
    secret: string | null;
  }): ParsedDelivery {
    if (req.secret === null) return { kind: "no_secret" };
    const signature = req.headers.get(SIGNATURE_HEADER);
    if (signature === undefined) return { kind: "missing_signature" };
    if (!verifyHmacSha256Hex(req.secret, req.rawBody, signature)) return { kind: "bad_signature" };

    const event = req.headers.get(EVENT_HEADER);
    if (event !== undefined && event !== "whatsapp.message.received" && event !== "whatsapp.message.sent") {
      this.noteIgnored(event);
      return { kind: "ok", events: [{ kind: "ignored", reason: "receipt" }] };
    }
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(req.rawBody));
    } catch {
      return { kind: "malformed" };
    }
    const parsed = liveDeliverySchema.safeParse(json);
    if (!parsed.success) return { kind: "malformed" };
    const events: ProviderEvent[] = parsed.data.map((i) =>
      i.message.type === "reaction"
        ? { kind: "ignored", reason: "reaction" }
        : { kind: "message", message: toMessage(i.message, i.conversation?.id ?? null) },
    );
    return { kind: "ok", events };
  }

  async businessNumber(signal: AbortSignal): Promise<PhoneNumber | null> {
    const r = await this.request("GET", `/platform/v1/whatsapp/phone_numbers/${this.o.phoneNumberId}`, null, signal, false);
    const shown = this.parse(phoneNumberSchema, r.body).data.display_phone_number;
    if (shown === null || shown === undefined) return null;
    const parsed = this.o.parser.parse(shown, null);
    return parsed.ok ? parsed.number : null;
  }

  /** Delivered and read receipts are expected noise; any other event name is logged with a count, never its payload. */
  private noteIgnored(event: string): void {
    if (event === "whatsapp.message.delivered" || event === "whatsapp.message.read") return;
    const name = event.slice(0, 80).replace(/[^ -~]/g, "?");
    const n = (this.ignoredEvents.get(name) ?? 0) + 1;
    this.ignoredEvents.set(name, n);
    console.error(`deputy: ignored Kapso event ${name} (${n} so far)`);
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

  private async request(
    method: "GET" | "POST",
    path: string,
    payload: unknown,
    signal: AbortSignal,
    isSend: boolean,
  ): Promise<{ body: unknown; serverTime: Instant; remaining: number | null }> {
    // reads keep a reserve of the minute for sends: they wait for the next provider minute when it runs low; sends never wait
    if (!isSend) await this.pacer.beforeRead();
    const timeout = AbortSignal.timeout(this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.o.baseUrl}${path}`, {
        method,
        headers: {
          "X-API-Key": this.o.apiKey.reveal(),
          ...(payload === null ? {} : { "content-type": "application/json" }),
        },
        body: payload === null ? null : JSON.stringify(payload),
        signal: AbortSignal.any([signal, timeout]),
      });
    } catch {
      if (signal.aborted) throw new ProviderError("timeout", null, isSend);
      throw new ProviderError(timeout.aborted ? "timeout" : "unreachable", null, isSend);
    }

    if (res.status === 401 || res.status === 403) throw new ProviderError("credentials", null, false);
    if (res.status === 402) throw new ProviderError("quota", null, false);
    if (res.status === 429) {
      const seconds = Number(res.headers.get("retry-after"));
      throw new ProviderError("rate_limited", Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null, false);
    }
    if (res.status >= 500) throw new ProviderError("unreachable", null, isSend);
    if (!res.ok) throw new ProviderError("bad_response", null, false);

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ProviderError(timeout.aborted ? "timeout" : "bad_response", null, timeout.aborted && isSend);
    }
    const date = Date.parse(res.headers.get("date") ?? "");
    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "");
    const result = {
      body,
      serverTime: Number.isNaN(date) ? this.o.clock.now() : date,
      remaining: res.headers.has("x-ratelimit-remaining") && Number.isFinite(remaining) ? remaining : null,
    };
    this.pacer.observe(result);
    return result;
  }
}
