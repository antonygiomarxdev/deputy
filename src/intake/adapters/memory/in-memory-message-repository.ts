import { messageIdKey, type MessageId } from "../../../shared/message-id";
import { Message, type MessageVersion } from "../../domain/message";
import type { MessageRepository } from "../../ports/message-repository";
import { bySent, copyMessage, type State } from "./in-memory-state";

export function inMemoryMessageRepository(s: () => State): MessageRepository {
  const world = (dev: boolean) => [...s().messages.values()].filter((m) => m.message.props.dev === dev);
  return {
    async insertIfNew(m) {
      const key = messageIdKey(m.props.id);
      if (s().messages.has(key)) return "duplicate";
      s().messages.set(key, { seq: s().nextSeq++, message: copyMessage(m) });
      return "stored";
    },
    async find(id) {
      const found = s().messages.get(messageIdKey(id));
      return found === undefined ? null : copyMessage(found.message);
    },
    async findMany(ids) {
      return ids.flatMap((id) => {
        const found = s().messages.get(messageIdKey(id));
        return found === undefined ? [] : [copyMessage(found.message)];
      });
    },
    async saveEdit(id: MessageId, version: MessageVersion, text: string) {
      const found = s().messages.get(messageIdKey(id));
      if (found === undefined) return;
      found.message = Message.rehydrate({ ...found.message.props, text, edited: true }, [
        ...found.message.versions,
        version,
      ]);
    },
    async markDeleted(id) {
      s().messages.get(messageIdKey(id))?.message.markDeletedBySender();
    },
    async listChat(chat, q) {
      const all = [...s().messages.values()].filter((m) => m.message.props.chat === chat).sort(bySent);
      const limit = q.limit;
      const keep =
        limit === undefined
          ? all
          : all.filter(
              (m, i) => i >= all.length - limit || (q.storedSince !== undefined && m.message.props.storedAt >= q.storedSince),
            );
      return keep.map((m) => copyMessage(m.message));
    },
    async reclassify(id, change) {
      // the SQLite adapter's NOT NULL column refuses a change with no time: both writes or neither
      if (!Number.isFinite(change.at)) throw new Error("a source change needs a time");
      const found = s().messages.get(messageIdKey(id));
      if (found === undefined || !found.message.reclassifyAsDeputySend(change.sendId, change.at).ok) return;
      s().sourceChanges.push(change);
    },
    async countCustomerMessages(chat) {
      return [...s().messages.values()].filter((m) => m.message.props.chat === chat && m.message.props.source === "customer" && !m.message.props.dev).length;
    },
    async chatExists(chat) {
      const mine = [...s().messages.values()].filter((m) => m.message.props.chat === chat);
      return { exists: mine.length > 0, hasNonDevMessage: mine.some((m) => !m.message.props.dev) };
    },
    async hasCustomerTextNorm(norm) {
      return [...s().messages.values()].some((m) => m.message.props.source === "customer" && m.message.textNorm === norm);
    },
    async newestStoredBefore(provider, scope, before) {
      const times = [...s().messages.values()]
        .map((m) => m.message.props)
        .filter((p) => p.id.provider === provider && p.sentAt < before)
        .filter((p) => ("conversationRef" in scope ? p.conversationRef === scope.conversationRef : p.source === "owner_app" || p.source === "sent_through_deputy"))
        .map((p) => p.sentAt);
      return times.length === 0 ? null : Math.max(...times);
    },
    async newestStoredAt(provider) {
      const times = [...s().messages.values()].filter((m) => m.message.props.id.provider === provider).map((m) => m.message.props.sentAt);
      return times.length === 0 ? null : Math.max(...times);
    },
    async oldestStoredAt(provider) {
      const times = [...s().messages.values()].filter((m) => m.message.props.id.provider === provider).map((m) => m.message.props.sentAt);
      return times.length === 0 ? null : Math.min(...times);
    },
    async newestUnattributedStoredAt(dev) {
      const stored = world(dev).filter((m) => m.message.props.mark === "not_attributable").map((m) => m.message.props.storedAt);
      return stored.length === 0 ? null : Math.max(...stored);
    },
  };
}
