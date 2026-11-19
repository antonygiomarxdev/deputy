import { verifyHmacSha256Hex } from "../hmac";
import type { ParsedDelivery, ProviderEvent } from "../../ports/provider";
import { toMessage } from "./kapso-mapping";
import { liveDeliverySchema } from "./kapso-schemas";

const SIGNATURE_HEADER = "x-webhook-signature";
const EVENT_HEADER = "x-webhook-event";

/** Verifies and parses a Kapso webhook delivery. Keeps a count of the event names it ignores. */
export class KapsoWebhook {
  private readonly ignoredEvents = new Map<string, number>();

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

  /** Delivered and read receipts are expected noise; any other event name is logged with a count, never its payload. */
  private noteIgnored(event: string): void {
    if (event === "whatsapp.message.delivered" || event === "whatsapp.message.read") return;
    const name = event.slice(0, 80).replace(/[^ -~]/g, "?");
    const n = (this.ignoredEvents.get(name) ?? 0) + 1;
    this.ignoredEvents.set(name, n);
    console.error(`deputy: ignored Kapso event ${name} (${n} so far)`);
  }
}
