import { Database } from "bun:sqlite";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { signDevBody } from "../../src/intake/adapters/dev/dev-delivery";
import { startServer, waitForOwner, writeConfig, type Harness } from "./harness";

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

/**
 * Stops a running server and starts it again as a Kapso server on the same folders, keeping its stored messages.
 * Kapso needs a business number, which Setup will store; here the test seeds it.
 */
export async function switchToKapso(first: Harness, fakeUrl: string, receivingMode: string | null = null): Promise<Harness> {
  await first.close();
  const db = new Database(join(first.dataDir, "deputy.db"));
  db.run("INSERT INTO owner_numbers (number, kind, label, added_at) VALUES ('+50588880000', 'business', '', 1)");
  db.close();
  writeConfig(first.configDir, {
    provider: "kapso",
    kapso_phone_number_id: "pn-1",
    ...(receivingMode === null ? {} : { receiving_mode: receivingMode }),
  });
  writeFileSync(join(first.configDir, "secrets.env"), "kapso-api-key=key-1\nkapso-webhook-secret=hook-secret\n");
  const next = await startServer(
    { DEPUTY_KAPSO_BASE_URL: fakeUrl, DEPUTY_PORT: String(first.port) },
    { dataDir: first.dataDir, configDir: first.configDir },
  );
  await waitForOwner(next);
  return next;
}
