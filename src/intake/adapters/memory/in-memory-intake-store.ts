import type { ChatId } from "../../../shared/chat-id";
import { UNATTRIBUTED_CHAT } from "../../../shared/chat-id";
import type { Instant } from "../../../shared/instant";
import { messageIdKey, type MessageId } from "../../../shared/message-id";
import type { ProviderName } from "../../../shared/provider-name";
import type { SendId } from "../../../shared/send-id";
import type { ChatState } from "../../domain/chat-state";
import { Message, type Mark, type MessageVersion } from "../../domain/message";
import { SyncState, type SyncStateProps } from "../../domain/sync-state";
import type { RejectionNote, RejectionReason } from "../../domain/rejection-note";
import type { ChatSeen, ChatStateRepository } from "../../ports/chat-state-repository";
import type { IntakeRepos, IntakeUnitOfWork } from "../../ports/intake-unit-of-work";
import type { MessageRepository } from "../../ports/message-repository";
import type { OutgoingRepository } from "../../ports/outgoing-repository";
import { REJECTION_MAX_AGE_MS, REJECTION_MAX_ROWS, type RejectionRepository } from "../../ports/rejection-repository";
import type { SyncStateRepository } from "../../ports/sync-state-repository";
import { InMemoryOwnerNumbersRepository } from "./in-memory-owner-numbers-repository";

interface Stored {
  seq: number;
  message: Message;
}
interface Rejection extends RejectionNote {
  id: number;
}
interface State {
  nextSeq: number;
  messages: Map<string, Stored>;
  chats: Map<string, ChatState>;
  rejections: Rejection[];
  nextRejectionId: number;
  pruned: number;
  sync: Map<ProviderName, SyncStateProps>;
  outgoingParts: Map<string, { sendId: SendId; part: number }>;
}

const copyMessage = (m: Message): Message => Message.rehydrate(m.props, m.versions);

function copyState(s: State): State {
  return {
    nextSeq: s.nextSeq,
    messages: new Map([...s.messages].map(([k, v]) => [k, { seq: v.seq, message: copyMessage(v.message) }])),
    chats: new Map(s.chats),
    rejections: s.rejections.map((r) => ({ ...r })),
    nextRejectionId: s.nextRejectionId,
    pruned: s.pruned,
    sync: new Map([...s.sync].map(([k, v]) => [k, { ...v }])),
    outgoingParts: new Map(s.outgoingParts),
  };
}

function chatMark(chat: ChatId): Mark {
  if (chat.startsWith("group:")) return "group_chat";
  return chat === UNATTRIBUTED_CHAT ? "not_attributable" : "normal";
}

const bySent = (a: Stored, b: Stored): number => a.message.props.sentAt - b.message.props.sentAt || a.seq - b.seq;
const newest = (items: Stored[]): Stored | undefined => items.sort((a, b) => bySent(b, a))[0];

/** The repositories and the unit of work over one state object; the unit of work restores a copy when `work` throws. */
export class InMemoryIntakeStore {
  private state: State = {
    nextSeq: 1,
    messages: new Map(),
    chats: new Map(),
    rejections: [],
    nextRejectionId: 1,
    pruned: 0,
    sync: new Map(),
    outgoingParts: new Map(),
  };
  readonly owners = new InMemoryOwnerNumbersRepository();

  readonly repos: IntakeRepos = {
    messages: this.messageRepository(),
    chats: this.chatRepository(),
    rejections: this.rejectionRepository(),
    syncState: this.syncRepository(),
    outgoing: this.outgoingRepository(),
    owners: this.owners,
  };

  readonly unitOfWork: IntakeUnitOfWork = {
    run: async (work) => {
      const before = copyState(this.state);
      try {
        return await work(this.repos);
      } catch (e) {
        this.state = before;
        throw e;
      }
    },
  };

  /** Test seam: what SPEC-04's send path would write. */
  addOutgoingPart(provider: ProviderName, providerMessageId: string, sendId: SendId, part: number): void {
    this.state.outgoingParts.set(`${provider}:${providerMessageId}`, { sendId, part });
  }

  private messageRepository(): MessageRepository {
    const s = (): State => this.state;
    const world = (dev: boolean): Stored[] => [...s().messages.values()].filter((m) => m.message.props.dev === dev);
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
          .filter((p) => ("conversationRef" in scope ? p.conversationRef === scope.conversationRef : p.source !== "customer"))
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

  private chatRepository(): ChatStateRepository {
    const s = (): State => this.state;
    const key = (chat: ChatId, dev: boolean): string => `${chat}|${dev ? 1 : 0}`;
    return {
      async recompute(chat: ChatId, dev: boolean, now: Instant, seen: ChatSeen) {
        const mine = [...s().messages.values()].filter((m) => m.message.props.chat === chat && m.message.props.dev === dev);
        const customer = newest(mine.filter((m) => m.message.props.source === "customer" && m.message.props.mark === "normal"));
        const answer = newest(mine.filter((m) => m.message.props.source !== "customer"));
        const unattributed = mine.filter((m) => m.message.props.mark === "not_attributable").map((m) => m.message.props.sentAt);
        const old = s().chats.get(key(chat, dev));
        const source = answer?.message.props.source;
        s().chats.set(key(chat, dev), {
          chat,
          dev,
          mark: chatMark(chat),
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

  private rejectionRepository(): RejectionRepository {
    const s = (): State => this.state;
    return {
      async add(at: Instant, reason: RejectionReason, recoverable: boolean) {
        s().rejections.push({ id: s().nextRejectionId++, at, reason, recoverable, resolvedAt: null });
        const before = s().rejections.length;
        s().rejections = s().rejections.filter((r) => r.at >= at - REJECTION_MAX_AGE_MS);
        s().rejections = s().rejections.slice(-REJECTION_MAX_ROWS);
        s().pruned += before - s().rejections.length;
      },
      async list() {
        const notes = [...s().rejections].reverse().map(({ at, reason, recoverable, resolvedAt }) => ({ at, reason, recoverable, resolvedAt }));
        return {
          notes,
          prunedCount: s().pruned,
          unrecovered: notes.filter((n) => n.recoverable && n.resolvedAt === null).length,
        };
      },
      async resolveRecoverableBefore(runStartedAt, at) {
        s().rejections = s().rejections.map((r) =>
          r.recoverable && r.resolvedAt === null && r.at < runStartedAt ? { ...r, resolvedAt: at } : r,
        );
      },
    };
  }

  private syncRepository(): SyncStateRepository {
    const s = (): State => this.state;
    const later = (a: Instant | null, b: Instant | null): Instant | null => (a === null ? b : b === null ? a : Math.max(a, b));
    return {
      async connectedAt(p) {
        return s().sync.get(p)?.connectedAt ?? null;
      },
      async markLiveVerified(p, at) {
        s().sync.set(p, { ...(s().sync.get(p) ?? SyncState.initial(p).props), liveVerifiedAt: at });
      },
      async liveVerifiedAt(p) {
        return s().sync.get(p)?.liveVerifiedAt ?? null;
      },
      async load(p) {
        const row = s().sync.get(p);
        return row === undefined ? null : SyncState.rehydrate(row);
      },
      async save(state) {
        const n = state.props;
        const old = s().sync.get(n.provider);
        s().sync.set(n.provider, {
          ...n,
          connectedAt: old?.connectedAt ?? n.connectedAt,
          markConversations: later(old?.markConversations ?? null, n.markConversations),
          markOutbound: later(old?.markOutbound ?? null, n.markOutbound),
          liveVerifiedAt: old?.liveVerifiedAt ?? null,
        });
      },
    };
  }

  private outgoingRepository(): OutgoingRepository {
    const s = (): State => this.state;
    return {
      async findByProviderId(provider, providerMessageId) {
        return s().outgoingParts.get(`${provider}:${providerMessageId}`) ?? null;
      },
    };
  }
}
