import { createServer } from "node:net";

export interface FakeKapsoOptions {
  apiKey: string;
  phoneNumberId: string;
  /** Raw conversation records, as Kapso returns them. */
  conversations?: Record<string, unknown>[];
  /** Raw message records, newest first. Each carries `kapso.whatsapp_conversation_id` and `kapso.direction`. */
  messages?: Record<string, unknown>[];
  phoneNumberRecord?: unknown;
  sendResponse?: unknown;
}

export interface SentRequest {
  headers: Headers;
  body: unknown;
  path: string;
}

type Route = "conversations" | "messages" | "phone" | "send";
interface Forced {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

const SERVER_DATE = "Tue, 14 Nov 2023 22:20:00 GMT";

/** A scripted Kapso: base64 offset cursors, `X-RateLimit-Remaining`, `Date`, forced errors, per-route delay, recorded sends. */
export function startFakeKapso(o: FakeKapsoOptions) {
  const state = {
    conversations: o.conversations ?? [],
    messages: o.messages ?? [],
    phoneNumberRecord: o.phoneNumberRecord ?? { data: { display_phone_number: null } },
    sendResponse: o.sendResponse ?? { messages: [{ id: "wamid.SENT1" }] },
    remaining: 99,
    delayMs: {} as Partial<Record<Route, number>>,
    forced: {} as Partial<Record<Route, Forced>>,
    sent: [] as SentRequest[],
    requests: [] as string[],
  };

  const page = (items: Record<string, unknown>[], url: URL) => {
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const after = url.searchParams.get("after");
    const start = after === null ? 0 : Number(atob(after));
    const slice = items.slice(start, start + limit);
    const more = start + limit < items.length;
    const cursor = btoa(String(start + limit));
    return { data: slice, paging: { cursors: { after: more ? cursor : null }, next: more ? cursor : null, previous: null } };
  };

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      const route: Route | null = url.pathname.endsWith("/conversations")
        ? "conversations"
        : url.pathname.endsWith("/messages") && url.pathname.startsWith("/platform/")
          ? "messages"
          : url.pathname.includes("/phone_numbers/")
            ? "phone"
            : url.pathname.endsWith("/messages") && url.pathname.startsWith("/meta/")
              ? "send"
              : null;
      if (route === null) return new Response("not found", { status: 404 });
      state.requests.push(`${req.method} ${url.pathname}${url.search}`);
      const delay = state.delayMs[route];
      if (delay !== undefined) await new Promise((r) => setTimeout(r, delay));

      if (req.headers.get("x-api-key") !== o.apiKey) return Response.json({ error: "bad key" }, { status: 401 });
      const forced = state.forced[route];
      if (forced !== undefined) {
        return Response.json(forced.body ?? {}, { status: forced.status, headers: forced.headers ?? {} });
      }
      state.remaining -= 1;
      const headers = { Date: SERVER_DATE, "X-RateLimit-Remaining": String(state.remaining) };

      if (route === "conversations") {
        const activeAfter = url.searchParams.get("last_active_after");
        const items = state.conversations.filter(
          (c) => activeAfter === null || Date.parse(String(c["last_active_at"])) > Date.parse(activeAfter),
        );
        return Response.json(page(items, url), { headers });
      }
      if (route === "messages") {
        const conv = url.searchParams.get("conversation_id");
        const direction = url.searchParams.get("direction");
        const items = state.messages.filter((m) => {
          const k = m["kapso"] as Record<string, unknown>;
          return (conv === null || k["whatsapp_conversation_id"] === conv) && (direction === null || k["direction"] === direction);
        });
        return Response.json(page(items, url), { headers });
      }
      if (route === "phone") return Response.json(state.phoneNumberRecord, { headers });
      state.sent.push({ headers: req.headers, body: await req.json(), path: url.pathname });
      return Response.json(state.sendResponse, { headers });
    },
  });

  return {
    url: `http://127.0.0.1:${server.port}`,
    state,
    force(route: Route, f: Forced) {
      state.forced[route] = f;
    },
    delay(route: Route, ms: number) {
      state.delayMs[route] = ms;
    },
    stop() {
      void server.stop(true);
    },
  };
}

/** A local port nothing listens on, for connection-refused tests. */
export async function closedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      s.close(() => (port === 0 ? reject(new Error("no port")) : resolve(port)));
    });
  });
}
