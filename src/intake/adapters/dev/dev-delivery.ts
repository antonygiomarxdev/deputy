import { z } from "zod";
import type { Instant } from "../../../shared/instant";
import { signHmacSha256Hex } from "../hmac";

/** A constant: dev mode is for testing on loopback (TP-01 threat model). */
export const DEV_WEBHOOK_SECRET = "deputy-dev-secret";
export const DEV_SIGNATURE_HEADER = "x-webhook-signature";

export interface DevDeliveryBody {
  chat: string;
  from: string;
  text: string;
  type?: string;
  transcript?: string | null;
  sentAt?: Instant;
  owner?: boolean;
  history?: boolean;
  providerMessageId?: string;
}

export const devDeliverySchema: z.ZodType<DevDeliveryBody> = z.object({
  chat: z.string().min(1),
  from: z.string().min(1),
  text: z.string(),
  type: z.string().optional(),
  transcript: z.string().nullable().optional(),
  sentAt: z.number().optional(),
  owner: z.boolean().optional(),
  history: z.boolean().optional(),
  providerMessageId: z.string().optional(),
});

export function signDevBody(rawBody: Uint8Array): string {
  return `sha256=${signHmacSha256Hex(DEV_WEBHOOK_SECRET, rawBody)}`;
}
