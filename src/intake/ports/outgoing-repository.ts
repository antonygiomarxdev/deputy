import type { ProviderName } from "../../shared/provider-name";
import type { SendId } from "../../shared/send-id";

/** SPEC-04 adds the other methods. */
export interface OutgoingRepository {
  findByProviderId(provider: ProviderName, providerMessageId: string): Promise<{ sendId: SendId; part: number } | null>;
}
