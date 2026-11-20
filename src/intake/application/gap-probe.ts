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

/** The coverage marks read before a run's sweeps move them: markConversations and markOutbound. */
export interface PreRunMarks {
  conversations: Instant | null;
  outbound: Instant | null;
}

/**
 * A listing read to its end, starting at O, while Deputy holds an older message of the same scope means messages between the two
 * may be missing, but only when Deputy had not already read up to O: the pre-run mark of that scope is null or before O. A mark at
 * or after O is provider retention, not a gap, and is not reported again. The first gap found is kept.
 */
export async function probeGap(i: {
  listings: readonly ListingRead[];
  marksBefore: PreRunMarks;
  messages: MessageRepositoryGap;
  provider: ProviderName;
}): Promise<{ storedAt: Instant; returnedAt: Instant } | null> {
  for (const listing of i.listings) {
    if (!listing.exhausted || listing.oldestReturned === null) continue;
    const mark = "conversationRef" in listing.scope ? i.marksBefore.conversations : i.marksBefore.outbound;
    if (mark !== null && mark >= listing.oldestReturned) continue;
    const storedAt = await i.messages.newestStoredBefore(i.provider, listing.scope, listing.oldestReturned);
    if (storedAt !== null) return { storedAt, returnedAt: listing.oldestReturned };
  }
  return null;
}
