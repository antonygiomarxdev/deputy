import { z } from "zod";
import type { DeliverDevMessage, DevMessageInput } from "../../ports/deliver-dev-message";
import type { ReceiveLiveDelivery } from "../../ports/receive-live-delivery";
import { devDeliverySchema } from "../dev/dev-delivery";
import { statusOf } from "./listener";

export interface DevRoutesDeps {
  provider: "kapso" | "dev";
  deliver: DeliverDevMessage & { refuse(): Promise<void> };
  /** Writes a body into what the dev provider holds, nothing else. Null under Kapso. */
  hold: ((q: DevMessageInput) => Promise<void>) | null;
  receive: ReceiveLiveDelivery;
}

const forgeSchema = z.object({ signature: z.string().optional() }).passthrough();

function badRequest(issue: z.ZodError): Response {
  const fields = [...new Set(issue.issues.map((i) => i.path.join(".") || "body"))];
  return Response.json({ error: "invalid_body", fields }, { status: 400 });
}

/**
 * The loopback test entry points: `/dev/deliver` (hold, sign, receive), `/dev/hold` (hold only), `/dev/forge` (a delivery that
 * claims to be signed). Under Kapso every `/dev/` path answers 404 and leaves a rejection note with no content.
 */
export function devRoutes(d: DevRoutesDeps): (req: Request) => Promise<Response | null> {
  return async (req) => {
    const path = new URL(req.url).pathname;
    if (!path.startsWith("/dev/")) return null;
    if (d.provider !== "dev") {
      await d.deliver.refuse();
      return new Response("not found", { status: 404 });
    }
    if (req.method !== "POST") return null;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return Response.json({ error: "malformed" }, { status: 400 });
    }

    if (path === "/dev/forge") {
      const forged = forgeSchema.safeParse(json);
      if (!forged.success) return badRequest(forged.error);
      const { signature, ...delivery } = forged.data;
      const rawBody = new TextEncoder().encode(JSON.stringify(delivery));
      const headers = new Map<string, string>(signature === undefined ? [] : [["x-webhook-signature", signature]]);
      const result = await d.receive.execute({ rawBody, headers });
      return new Response(result.kind, { status: statusOf(result) });
    }

    const body = devDeliverySchema.safeParse(json);
    if (!body.success) return badRequest(body.error);
    if (path === "/dev/hold") {
      if (d.hold === null) return new Response("not found", { status: 404 });
      await d.hold(body.data);
      return new Response(null, { status: 204 });
    }
    if (path === "/dev/deliver") {
      const r = await d.deliver.execute(body.data);
      if (r.ok) return Response.json({ result: r.result });
      return Response.json({ error: r.reason }, { status: r.reason === "storage_failed" ? 500 : r.reason === "not_dev" ? 404 : 400 });
    }
    return null;
  };
}
