import type { IncomingRequest, Provider, WebhookResult } from "../types.js";

/**
 * Dev provider: no WhatsApp. Lets you test the whole flow locally.
 *   Inbound:   POST /webhook  {"from":"50588887777","name":"Ana","text":"hi"}
 *   Outbound:  GET  /dev/events  (SSE stream of what Claude replies)
 */
export function createDevProvider(): Provider & { subscribe(fn: (line: string) => void): () => void } {
  const listeners = new Set<(line: string) => void>();
  let n = 0;
  const emit = (line: string) => {
    for (const l of listeners) l(line);
  };

  return {
    name: "dev",
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async sendText(to, text) {
      const id = `dev-out-${++n}`;
      emit(JSON.stringify({ to, text, id }));
      return { id };
    },
    async markRead() {},
    async handleWebhook(req: IncomingRequest): Promise<WebhookResult> {
      if (req.method !== "POST") return { response: { status: 405, body: "POST only" }, messages: [], echoes: [] };
      const b = JSON.parse(req.rawBody.toString("utf8") || "{}");
      if (b.echo) {
        return { response: { status: 200, body: "ok" }, messages: [], echoes: [{ to: String(b.to), text: String(b.text ?? ""), timestamp: Date.now() }] };
      }
      if (!b.from || typeof b.text !== "string") return { response: { status: 400, body: "need from + text" }, messages: [], echoes: [] };
      return {
        response: { status: 200, body: "ok" },
        messages: [{ id: b.id ?? `dev-in-${Date.now()}-${++n}`, from: String(b.from), name: b.name, text: b.text, timestamp: Date.now() }],
        echoes: [],
      };
    },
  };
}
