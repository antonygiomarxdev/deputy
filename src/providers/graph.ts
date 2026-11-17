import { createHmac, timingSafeEqual } from "node:crypto";
import type { Inbound } from "../types.js";

/** Minimal WhatsApp Graph API client (works for Meta direct and Graph-compatible proxies such as Kapso). */
export class GraphSender {
  constructor(
    private opts: {
      baseUrl: string; // https://graph.facebook.com  |  https://api.kapso.ai/meta/whatsapp
      version: string; // v23.0
      phoneNumberId: string;
      headers: Record<string, string>; // Authorization: Bearer …  |  X-API-Key: …
    },
  ) {}

  private async post(body: unknown) {
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}/${this.opts.version}/${this.opts.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.opts.headers },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${text.slice(0, 500)}`);
    return JSON.parse(text || "{}");
  }

  async sendText(to: string, text: string) {
    let lastId: string | undefined;
    for (const chunk of splitText(text, 4000)) {
      const r = await this.post({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: chunk, preview_url: false },
      });
      lastId = r?.messages?.[0]?.id;
    }
    return { id: lastId };
  }

  async markRead(messageId: string) {
    await this.post({ messaging_product: "whatsapp", status: "read", message_id: messageId });
  }
}

export function splitText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

/** Hex HMAC-SHA256, constant-time compare. Accepts a "sha256=" prefix. */
export function verifyHmac(secret: string, rawBody: Buffer, header?: string): boolean {
  const sig = header?.replace(/^sha256=/, "").trim();
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Turns a Graph-API-shaped message into text Claude can read. */
export function graphMessageToInbound(m: any, name?: string): Inbound | null {
  if (!m?.id || !m?.from) return null;
  let text: string;
  switch (m.type) {
    case "text":
      text = m.text?.body ?? "";
      break;
    case "interactive":
      text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "[interactive reply]";
      break;
    case "button":
      text = m.button?.text ?? "[button]";
      break;
    case "image":
    case "video":
    case "document":
      text = `[${m.type}]${m[m.type]?.caption ? ` ${m[m.type].caption}` : ""}`;
      break;
    case "audio":
      text = "[voice note]";
      break;
    case "location":
      text = `[location] ${m.location?.name ?? ""} ${m.location?.address ?? ""} (${m.location?.latitude}, ${m.location?.longitude})`.trim();
      break;
    case "sticker":
      text = "[sticker]";
      break;
    case "reaction":
      return null; // reactions need no reply
    default:
      text = `[${m.type ?? "unknown"} message]`;
  }
  return {
    id: String(m.id),
    from: String(m.from),
    name,
    text,
    timestamp: Number(m.timestamp ?? Date.now() / 1000) * 1000,
  };
}
