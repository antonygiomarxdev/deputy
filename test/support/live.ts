import { signDevBody } from "../../src/intake/adapters/dev/dev-delivery";
import type { Harness } from "./harness";

export interface DevBody {
  chat: string;
  from: string;
  text: string;
  sentAt?: number;
  providerMessageId?: string;
}

export const url = (h: Harness, path: string) => `http://127.0.0.1:${h.port}${path}`;

/** Posts a body to /webhook, signed with the dev secret unless `signature` says otherwise. */
export async function postDelivery(
  h: Harness,
  body: DevBody | Uint8Array,
  signature: "dev" | "none" | string = "dev",
): Promise<Response> {
  const raw = body instanceof Uint8Array ? body : new TextEncoder().encode(JSON.stringify(body));
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature === "dev") headers["x-webhook-signature"] = signDevBody(raw);
  else if (signature !== "none") headers["x-webhook-signature"] = signature;
  return fetch(url(h, "/webhook"), { method: "POST", headers, body: new Blob([raw.slice().buffer]) });
}
