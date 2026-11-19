import type { ReceiveLiveDelivery } from "../../ports/receive-live-delivery";

/** 1 MB (TP-02, "Body limit"): a delivery is a small JSON document. */
export const MAX_BODY_BYTES = 1_048_576;

export interface ListenerDeps {
  receive: ReceiveLiveDelivery;
  port: number;
  host: "127.0.0.1";
  /**
   * True while the dev provider is active: its webhook secret is a public constant, so the webhook then answers only requests
   * addressed to the loopback host and port. A Kapso webhook may arrive through a tunnel with a public Host and is not checked.
   */
  devProvider: boolean;
  /** The /dev/* routes (SPEC-01 Task 12). */
  extraRoutes?: (req: Request) => Promise<Response | null>;
}

type Received = Awaited<ReturnType<ReceiveLiveDelivery["execute"]>>;

export function statusOf(r: Received): number {
  switch (r.kind) {
    case "stored":
      return 200;
    case "rejected":
      return r.reason === "malformed" ? 400 : 401;
    case "storage_failed":
      return 500;
    case "live_off":
      return 404;
    case "refused":
      return 503;
  }
}

/** The body, or null when it is over the limit (by Content-Length, and by counting bytes when the header is absent). */
async function readBody(req: Request): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (req.body === null) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of req.body) {
    total += chunk.byteLength;
    if (total > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export class LiveListener {
  private server: ReturnType<typeof Bun.serve> | null = null;

  constructor(private readonly d: ListenerDeps) {}

  async start(): Promise<void> {
    if (this.server !== null) return;
    this.server = Bun.serve({ port: this.d.port, hostname: this.d.host, fetch: (req) => this.handle(req) });
  }

  async stop(): Promise<void> {
    const s = this.server;
    this.server = null;
    if (s !== null) await s.stop(true);
  }

  /**
   * A web page the owner visits can reach the loopback port: by a cross-origin request or by DNS rebinding. Providers send neither an
   * Origin header nor a foreign Host to a loopback listener, so those requests are refused before anything is read or stored.
   */
  private refusal(req: Request, url: URL): Response | null {
    if (req.headers.has("origin")) return new Response("forbidden", { status: 403 });
    const isDev = url.pathname.startsWith("/dev/");
    if ((isDev || (this.d.devProvider && url.pathname === "/webhook")) && !this.addressedToLoopback(req)) {
      return new Response("forbidden", { status: 403 });
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      const type = (req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
      if (type !== "application/json") return new Response("unsupported media type", { status: 415 });
    }
    return null;
  }

  private addressedToLoopback(req: Request): boolean {
    const host = req.headers.get("host");
    return host === `127.0.0.1:${this.d.port}` || host === `localhost:${this.d.port}`;
  }

  private async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const refused = this.refusal(req, url);
    if (refused !== null) return refused;
    if (req.method === "GET" && url.pathname === "/health") return new Response("ok");
    if (req.method === "POST" && url.pathname === "/webhook") {
      const body = await readBody(req);
      if (body === null) return new Response("body too large", { status: 413 });
      const headers = new Map<string, string>();
      req.headers.forEach((value, name) => headers.set(name.toLowerCase(), value));
      try {
        const result = await this.d.receive.execute({ rawBody: body, headers });
        return new Response(result.kind, { status: statusOf(result) });
      } catch (e) {
        // only the error name: its message could carry what was received
        console.error(`deputy: the live listener failed on a delivery (${e instanceof Error ? e.name : "unknown error"})`);
        return new Response("storage_failed", { status: 500 });
      }
    }
    const extra = await this.d.extraRoutes?.(req);
    return extra ?? new Response("not found", { status: 404 });
  }
}
