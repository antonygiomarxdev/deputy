import { flag, num, str, strOrNull } from "../../../adapters/sqlite/row";
import type { Clock } from "../../../shared/clock";
import type { Instant } from "../../../shared/instant";
import type { PhoneNumber } from "../../../shared/phone-number";
import type { SqlDatabase, SqlRow } from "../../../shared/sql-database";
import {
  assertLimit,
  toCursor,
  type Cursor,
  type Page,
  type ParsedDelivery,
  type Provider,
  type ProviderConversation,
  type ProviderMessage,
} from "../../ports/provider";
import { verifyHmacSha256Hex } from "../hmac";
import { DEV_SIGNATURE_HEADER, DEV_WEBHOOK_SECRET, devDeliverySchema, type DevDeliveryBody } from "./dev-delivery";
import { DevHoldingsRepository } from "./dev-holdings-repository";

const MAX_PAGE = 100;

function offsetOf(cursor: Cursor | null): number {
  const n = cursor === null ? 0 : Number(cursor);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function toMessage(r: SqlRow): ProviderMessage {
  const direction = str(r, "direction");
  if (direction !== "inbound" && direction !== "outbound") throw new Error(`dev holding direction '${direction}'`);
  return {
    providerMessageId: str(r, "provider_message_id"),
    conversationRef: strOrNull(r, "conversation_ref"),
    from: strOrNull(r, "sender"),
    counterpart: strOrNull(r, "counterpart"),
    direction,
    type: str(r, "type"),
    text: strOrNull(r, "text"),
    transcript: strOrNull(r, "transcript"),
    sentAt: num(r, "sent_at"),
    origin: strOrNull(r, "origin"),
    group: false,
    edited: false,
    profileName: null,
    devOwnerMark: flag(r, "owner_mark"),
  };
}

/** What a delivery body says about its message. A held copy and a verified webhook both read it here, so they cannot disagree. */
function readBody(b: DevDeliveryBody, clock: Clock) {
  const outbound = b.owner === true;
  const direction: "inbound" | "outbound" = outbound ? "outbound" : "inbound";
  return {
    outbound,
    direction,
    origin: outbound ? "business_app" : b.history === true ? "history_sync" : "cloud_api",
    type: b.type ?? "text",
    sentAt: b.sentAt ?? clock.now(),
  };
}

export class DevProvider implements Provider {
  readonly name = "dev";
  private readonly holdings: DevHoldingsRepository;

  constructor(private readonly d: { db: SqlDatabase; clock: Clock }) {
    this.holdings = new DevHoldingsRepository(d.db);
  }

  /** Copies a delivery body into dev_holdings as a real provider would; returns whether it was new. */
  async hold(b: DevDeliveryBody): Promise<{ providerMessageId: string; isNew: boolean }> {
    const f = readBody(b, this.d.clock);
    return this.holdings.insert({
      id: b.providerMessageId ?? null,
      kind: f.outbound ? "out" : "in",
      chat: b.chat,
      sender: b.from,
      direction: f.direction,
      type: f.type,
      text: b.text,
      transcript: b.transcript ?? null,
      origin: f.origin,
      sentAt: f.sentAt,
      ownerMark: f.outbound,
    });
  }

  async listConversations(
    q: { activeAfter: Instant | null; cursor: Cursor | null; limit: number },
  ): Promise<Page<ProviderConversation>> {
    assertLimit(q.limit);
    const limit = Math.min(q.limit, MAX_PAGE);
    const offset = offsetOf(q.cursor);
    const rows = await this.holdings.conversations(q.activeAfter, offset, limit);
    const items = rows.slice(0, limit).map((r) => ({
      ref: str(r, "conversation_ref"),
      counterpart: str(r, "conversation_ref"),
      group: false,
      lastActiveAt: num(r, "last"),
    }));
    return this.page(items, rows.length > limit, offset + limit);
  }

  async listMessages(
    q: { scope: { conversationRef: string } | { outbound: true }; cursor: Cursor | null; limit: number },
  ): Promise<Page<ProviderMessage>> {
    assertLimit(q.limit);
    const limit = Math.min(q.limit, MAX_PAGE);
    const offset = offsetOf(q.cursor);
    const rows = await this.holdings.messages(q.scope, offset, limit);
    return this.page(rows.slice(0, limit).map(toMessage), rows.length > limit, offset + limit);
  }

  async sendText(req: { to: PhoneNumber; text: string }): Promise<{ providerMessageId: string; serverTime: Instant }> {
    const serverTime = this.d.clock.now();
    const { providerMessageId } = await this.holdings.insert({
      id: null,
      kind: "out",
      chat: req.to.digits,
      sender: null,
      direction: "outbound",
      type: "text",
      text: req.text,
      transcript: null,
      origin: "cloud_api",
      sentAt: serverTime,
      ownerMark: false,
    });
    return { providerMessageId, serverTime };
  }

  /** The configured secret is ignored: dev deliveries are always signed with the dev secret. */
  verifyAndParse(req: { rawBody: Uint8Array; headers: ReadonlyMap<string, string> }): ParsedDelivery {
    const signature = req.headers.get(DEV_SIGNATURE_HEADER);
    if (signature === undefined) return { kind: "missing_signature" };
    if (!verifyHmacSha256Hex(DEV_WEBHOOK_SECRET, req.rawBody, signature)) return { kind: "bad_signature" };
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(req.rawBody));
    } catch {
      return { kind: "malformed" };
    }
    const parsed = devDeliverySchema.safeParse(json);
    if (!parsed.success) return { kind: "malformed" };
    const b = parsed.data;
    const f = readBody(b, this.d.clock);
    return {
      kind: "ok",
      events: [
        {
          kind: "message",
          message: {
            providerMessageId: b.providerMessageId ?? null,
            conversationRef: b.chat,
            from: b.from,
            counterpart: b.chat,
            direction: f.direction,
            type: f.type,
            text: b.text,
            transcript: b.transcript ?? null,
            sentAt: f.sentAt,
            origin: f.origin,
            group: false,
            edited: false,
            profileName: null,
            devOwnerMark: f.outbound,
          },
        },
      ],
    };
  }

  async businessNumber(): Promise<null> {
    return null;
  }

  private page<T>(items: T[], more: boolean, nextOffset: number): Page<T> {
    return { items, next: more ? toCursor(String(nextOffset)) : null, serverTime: this.d.clock.now(), remaining: null };
  }
}
