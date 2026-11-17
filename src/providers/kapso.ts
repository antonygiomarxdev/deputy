import { config } from "../config.js";
import type { Inbound, IncomingRequest, Provider, WebhookResult } from "../types.js";
import { GraphSender, graphMessageToInbound, verifyHmac } from "./graph.js";

/**
 * Kapso: a provider (BSP) that handles Meta onboarding for you. Sends through its
 * Graph-API-compatible proxy and receives signed platform webhooks.
 * Subscribe the webhook to the `whatsapp.message.received` event.
 */
export function createKapsoProvider(): Provider {
  const secret = config.req("KAPSO_WEBHOOK_SECRET");
  const sender = new GraphSender({
    baseUrl: config.env("KAPSO_BASE_URL", "https://api.kapso.ai/meta/whatsapp")!,
    version: config.env("KAPSO_GRAPH_VERSION", "v23.0")!,
    phoneNumberId: config.req("KAPSO_PHONE_NUMBER_ID"),
    headers: { "X-API-Key": config.req("KAPSO_API_KEY") },
  });

  return {
    name: "kapso",
    sendText: (to, text) => sender.sendText(to, text),
    markRead: (id) => sender.markRead(id),

    async handleWebhook(req: IncomingRequest): Promise<WebhookResult> {
      const empty = { messages: [], echoes: [] };
      if (req.method !== "POST") return { response: { status: 405, body: "method not allowed" }, ...empty };
      if (!verifyHmac(secret, req.rawBody, req.headers["x-webhook-signature"])) {
        return { response: { status: 401, body: "invalid signature" }, ...empty };
      }

      const eventName = req.headers["x-webhook-event"];
      if (eventName && eventName !== "whatsapp.message.received") {
        return { response: { status: 200, body: "ignored" }, ...empty };
      }

      const payload = JSON.parse(req.rawBody.toString("utf8") || "{}");
      const events: any[] = Array.isArray(payload?.data) ? payload.data : [payload];
      const messages: Inbound[] = [];

      for (const ev of events) {
        const type = ev?.event ?? ev?.type;
        if (type && type !== "whatsapp.message.received") continue;
        const m = ev?.message;
        if (!m || m?.kapso?.direction === "outbound") continue;
        const conv = ev?.conversation ?? {};
        const name = m?.kapso?.contactName ?? conv?.kapso?.contactName ?? conv?.contact_name ?? conv?.contactName;
        const inbound = graphMessageToInbound(m, name);
        if (inbound) messages.push(inbound);
      }
      return { response: { status: 200, body: "ok" }, messages, echoes: [] };
    },
  };
}
