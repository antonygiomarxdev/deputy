import type { DevDeliverySource, DevMessageInput } from "../../ports/deliver-dev-message";
import { DEV_SIGNATURE_HEADER, signDevBody } from "./dev-delivery";
import type { DevProvider } from "./dev-provider";

/** Holds a delivery at the dev provider and signs it with the dev secret, so it takes the same path as a Kapso delivery. */
export class DevDeliveries implements DevDeliverySource {
  constructor(private readonly provider: DevProvider) {}

  async signedDelivery(q: DevMessageInput): Promise<{ rawBody: Uint8Array; headers: ReadonlyMap<string, string> }> {
    const { providerMessageId } = await this.provider.hold(q);
    const rawBody = new TextEncoder().encode(JSON.stringify({ ...q, providerMessageId }));
    return { rawBody, headers: new Map([[DEV_SIGNATURE_HEADER, signDevBody(rawBody)]]) };
  }
}
