import type { ChatId } from "../../../shared/chat-id";
import type { Instant } from "../../../shared/instant";
import { chatMarkOf } from "../../domain/chat-state";
import type { ChatSeen, ChatStateRepository } from "../../ports/chat-state-repository";
import { bySent, type State, type Stored } from "./in-memory-state";

const newest = (items: Stored[]): Stored | undefined => items.sort((a, b) => bySent(b, a))[0];

export function inMemoryChatRepository(s: () => State): ChatStateRepository {
  const key = (chat: ChatId, dev: boolean): string => `${chat}|${dev ? 1 : 0}`;
  return {
    async recompute(chat: ChatId, dev: boolean, now: Instant, seen: ChatSeen) {
      const mine = [...s().messages.values()].filter((m) => m.message.props.chat === chat && m.message.props.dev === dev);
      const customer = newest(mine.filter((m) => m.message.props.source === "customer" && m.message.props.mark === "normal"));
      const answer = newest(mine.filter((m) => m.message.props.source === "owner_app" || m.message.props.source === "sent_through_deputy"));
      const unattributed = mine.filter((m) => m.message.props.mark === "not_attributable").map((m) => m.message.props.sentAt);
      const old = s().chats.get(key(chat, dev));
      const source = answer?.message.props.source;
      s().chats.set(key(chat, dev), {
        chat,
        dev,
        mark: chatMarkOf(chat),
        conversationRef: seen.conversationRef ?? old?.conversationRef ?? null,
        providerId: old?.providerId ?? seen.providerId,
        lastCustomerAt: customer?.message.props.sentAt ?? null,
        lastCustomerMessageId: customer?.message.props.id.providerMessageId ?? null,
        lastAnswerAt: answer?.message.props.sentAt ?? null,
        lastAnswerSource: source === "owner_app" || source === "sent_through_deputy" ? source : null,
        lastUnattributedAt: unattributed.length === 0 ? null : Math.max(...unattributed),
        profileName: old?.profileName ?? null,
        profileNameAt: old?.profileNameAt ?? null,
        updatedAt: now,
      });
    },
    async setProfileName(chat, dev, name, sentAt) {
      const old = s().chats.get(key(chat, dev));
      if (old !== undefined && (old.profileNameAt === null || old.profileNameAt < sentAt)) {
        s().chats.set(key(chat, dev), { ...old, profileName: name, profileNameAt: sentAt });
      }
    },
    async list(q) {
      return [...s().chats.values()]
        .filter((c) => c.dev === q.dev)
        .filter((c) => q.customerMessageSince === undefined || (c.lastCustomerAt !== null && c.lastCustomerAt >= q.customerMessageSince))
        .sort((a, b) => (a.chat < b.chat ? -1 : a.chat > b.chat ? 1 : 0));
    },
    async get(chat, dev) {
      return s().chats.get(key(chat, dev)) ?? null;
    },
  };
}
