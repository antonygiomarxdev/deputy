import { config } from "../config.js";
import type { Echo, Inbound, IncomingRequest, Provider, WebhookResult } from "../types.js";
import { GraphSender, graphMessageToInbound, verifyHmac } from "./graph.js";

/**
 * Meta direct: the WhatsApp Cloud API with no middleman.
 * Needs a Meta for Developers app with the WhatsApp product.
 */
export function createMetaProvider(): Provider {
  const phoneNumberId = config.req("META_PHONE_NUMBER_ID");
  const appSecret = config.req("META_APP_SECRET");
  const verifyToken = config.req("META_VERIFY_TOKEN");
  const sender = new GraphSender({
    baseUrl: config.env("META_GRAPH_URL", "https://graph.facebook.com")!,
    version: config.env("META_GRAPH_VERSION", "v23.0")!,
    phoneNumberId,
    headers: { Authorization: `Bearer ${config.req("META_ACCESS_TOKEN")}` },
  });

  return {
    name: "meta",
    sendText: (to, text) => sender.sendText(to, text),
    markRead: (id) => sender.markRead(id),

    async handleWebhook(req: IncomingRequest): Promise<WebhookResult> {
      const empty = { messages: [], echoes: [] };

      // Subscription verification (GET with hub.challenge)
      if (req.method === "GET") {
        const ok = req.query.get("hub.mode") === "subscribe" && req.query.get("hub.verify_token") === verifyToken;
        return ok
          ? { response: { status: 200, body: req.query.get("hub.challenge") ?? "" }, ...empty }
          : { response: { status: 403, body: "forbidden" }, ...empty };
      }

      if (!verifyHmac(appSecret, req.rawBody, req.headers["x-hub-signature-256"])) {
        return { response: { status: 401, body: "invalid signature" }, ...empty };
      }

      const payload = JSON.parse(req.rawBody.toString("utf8") || "{}");
      const messages: Inbound[] = [];
      const echoes: Echo[] = [];

      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const v = change.value ?? {};
          if (v.metadata?.phone_number_id && v.metadata.phone_number_id !== phoneNumberId) continue;

          if (change.field === "messages") {
            const names = new Map<string, string>();
            for (const c of v.contacts ?? []) if (c.wa_id) names.set(c.wa_id, c.profile?.name);
            for (const m of v.messages ?? []) {
              const inbound = graphMessageToInbound(m, names.get(m.from));
              if (inbound) messages.push(inbound);
            }
          }

          // Coexistence: what the owner replies from the WhatsApp Business app
          if (change.field === "smb_message_echoes") {
            for (const e of v.message_echoes ?? []) {
              if (e.to) echoes.push({ to: String(e.to), text: e.text?.body ?? `[${e.type}]`, timestamp: Number(e.timestamp ?? 0) * 1000 });
            }
          }
        }
      }
      return { response: { status: 200, body: "ok" }, messages, echoes };
    },
  };
}
