import { createHmac, timingSafeEqual } from "node:crypto";

export function signHmacSha256Hex(secret: string, rawBody: Uint8Array): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** Constant time; accepts a "sha256=" prefix. */
export function verifyHmacSha256Hex(secret: string, rawBody: Uint8Array, header: string | undefined): boolean {
  if (header === undefined) return false;
  const given = Buffer.from(header.replace(/^sha256=/, ""), "hex");
  const expected = Buffer.from(signHmacSha256Hex(secret, rawBody), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
