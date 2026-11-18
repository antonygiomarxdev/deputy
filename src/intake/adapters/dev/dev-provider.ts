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

export class DevProvider implements Provider {
  readonly name = "dev";

  constructor(private readonly d: { db: SqlDatabase; clock: Clock }) {}

  /** Copies a delivery body into dev_holdings as a real provider would; returns whether it was new. */
  async hold(b: DevDeliveryBody): Promise<{ providerMessageId: string; isNew: boolean }> {
    const outbound = b.owner === true;
    const origin = outbound ? "business_app" : b.history === true ? "history_sync" : "cloud_api";
    return this.insert({
      id: b.providerMessageId ?? null,
      kind: outbound ? "out" : "in",
      chat: b.chat,
      sender: b.from,
      direction: outbound ? "outbound" : "inbound",
      type: b.type ?? "text",
      text: b.text,
      transcript: b.transcript ?? null,
      origin,
      sentAt: b.sentAt ?? this.d.clock.now(),
      ownerMark: outbound,
    });
  }

  async listConversations(
    q: { activeAfter: Instant | null; cursor: Cursor | null; limit: number },
  ): Promise<Page<ProviderConversation>> {
    assertLimit(q.limit);
    const limit = Math.min(q.limit, MAX_PAGE);
    const offset = offsetOf(q.cursor);
    const rows = await this.d.db.query(
      `SELECT conversation_ref, MAX(sent_at) AS last FROM dev_holdings
       WHERE conversation_ref IS NOT NULL
       GROUP BY conversation_ref HAVING (? IS NULL OR MAX(sent_at) >= ?)
       ORDER BY last DESC, conversation_ref LIMIT ? OFFSET ?`,
      [q.activeAfter, q.activeAfter, limit + 1, offset],
    );
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
    const [where, params] =
      "conversationRef" in q.scope
        ? ["conversation_ref = ?", [q.scope.conversationRef]]
        : ["direction = 'outbound'", []];
    const rows = await this.d.db.query(
      `SELECT * FROM dev_holdings WHERE ${where} ORDER BY sent_at DESC, seq DESC LIMIT ? OFFSET ?`,
      [...params, limit + 1, offset],
    );
    return this.page(rows.slice(0, limit).map(toMessage), rows.length > limit, offset + limit);
  }

  async sendText(req: { to: PhoneNumber; text: string }): Promise<{ providerMessageId: string; serverTime: Instant }> {
    const serverTime = this.d.clock.now();
    const { providerMessageId } = await this.insert({
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
    const outbound = b.owner === true;
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
            direction: outbound ? "outbound" : "inbound",
            type: b.type ?? "text",
            text: b.text,
            transcript: b.transcript ?? null,
            sentAt: b.sentAt ?? this.d.clock.now(),
            origin: outbound ? "business_app" : b.history === true ? "history_sync" : "cloud_api",
            group: false,
            edited: false,
            profileName: null,
            devOwnerMark: outbound,
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

  private async insert(h: {
    id: string | null;
    kind: "in" | "out";
    chat: string;
    sender: string | null;
    direction: "inbound" | "outbound";
    type: string;
    text: string;
    transcript: string | null;
    origin: string;
    sentAt: Instant;
    ownerMark: boolean;
  }): Promise<{ providerMessageId: string; isNew: boolean }> {
    return this.d.db.transaction(async (tx) => {
      const placeholder = h.id ?? `dev-pending-${crypto.randomUUID()}`;
      const r = await tx.run(
        `INSERT INTO dev_holdings
           (provider_message_id, conversation_ref, counterpart, sender, direction, type, text, transcript, origin, sent_at, owner_mark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider_message_id) DO NOTHING`,
        [placeholder, h.chat, h.chat, h.sender, h.direction, h.type, h.text, h.transcript, h.origin, h.sentAt, h.ownerMark ? 1 : 0],
      );
      if (r.changes === 0) return { providerMessageId: placeholder, isNew: false };
      if (h.id !== null) return { providerMessageId: h.id, isNew: true };
      const id = `dev-${h.kind}-${r.lastInsertId}`;
      await tx.run("UPDATE dev_holdings SET provider_message_id = ? WHERE seq = ?", [id, r.lastInsertId]);
      return { providerMessageId: id, isNew: true };
    });
  }
}
