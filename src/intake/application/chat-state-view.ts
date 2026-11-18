import type { Instant } from "../../shared/instant";
import type { ChatState } from "../domain/chat-state";
import type { ChatStateView } from "../ports/views";

/**
 * `lastAnswerAt` is the later of the real answer and `lastUnattributedAt`; `lastAnswerSource` is "owner_app"
 * when the unattributed time is the newer one (an echo with no sender is the owner's own reply).
 */
export function toChatStateView(s: ChatState, unattributedStoredAt: Instant | null): ChatStateView {
  const unattributedIsNewer =
    s.lastUnattributedAt !== null && (s.lastAnswerAt === null || s.lastUnattributedAt > s.lastAnswerAt);
  return {
    chat: s.chat,
    mark: s.mark,
    conversationRef: s.conversationRef,
    lastCustomerAt: s.lastCustomerAt,
    // A chat state keeps no provider: the two worlds are exactly dev and Kapso.
    lastCustomerMessageId:
      s.lastCustomerMessageId === null
        ? null
        : { provider: s.dev ? "dev" : "kapso", providerMessageId: s.lastCustomerMessageId },
    lastAnswerAt: unattributedIsNewer ? s.lastUnattributedAt : s.lastAnswerAt,
    lastAnswerSource: unattributedIsNewer ? "owner_app" : s.lastAnswerSource,
    lastUnattributedAt: s.lastUnattributedAt,
    unattributedStoredAt,
    ...(s.profileName === null ? {} : { profileName: s.profileName }),
  };
}
