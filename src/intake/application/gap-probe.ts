import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";
import type { MessageRepositoryGap } from "../ports/message-repository";

export type ListingScope = { conversationRef: string } | { ownerOrDeputy: true };

/** One listing a run read: where, whether it was read to its end, and the oldest item it returned. */
export interface ListingRead {
  scope: ListingScope;
  exhausted: boolean;
  oldestReturned: Instant | null;
}

/**
 * A listing read to its end that starts at O, while Deputy holds an older message of the same scope, means the provider no longer
 * lists a stretch Deputy cannot fill: messages between the two may be missing. The first gap found is kept.
 */
export async function probeGap(i: {
  listings: readonly ListingRead[];
  messages: MessageRepositoryGap;
  provider: ProviderName;
}): Promise<{ storedAt: Instant; returnedAt: Instant } | null> {
  for (const listing of i.listings) {
    if (!listing.exhausted || listing.oldestReturned === null) continue;
    const storedAt = await i.messages.newestStoredBefore(i.provider, listing.scope, listing.oldestReturned);
    if (storedAt !== null) return { storedAt, returnedAt: listing.oldestReturned };
  }
  return null;
}
