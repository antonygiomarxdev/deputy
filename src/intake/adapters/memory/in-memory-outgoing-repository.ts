import { messageIdKey } from "../../../shared/message-id";
import { OutgoingSend } from "../../domain/outgoing-send";
import type { OutgoingRepository } from "../../ports/outgoing-repository";
import { bySent, type State } from "./in-memory-state";

export function inMemoryOutgoingRepository(s: () => State): OutgoingRepository {
  return {
    async find(sendId) {
      const props = s().sends.get(sendId);
      return props === undefined ? null : OutgoingSend.rehydrate(props);
    },
    async insert(send) {
      if (s().sends.has(send.props.sendId)) throw new Error("send id already used");
      s().sends.set(send.props.sendId, send.props);
    },
    async savePart(send, part, provider) {
      const stored = s().sends.get(send.props.sendId);
      const found = send.props.parts.find((x) => x.index === part);
      if (stored === undefined || found === undefined) throw new Error("no such send or part");
      if (found.providerMessageId !== null) {
        const key = `${provider}:${found.providerMessageId}`;
        const taken = s().outgoingParts.get(key);
        if (taken !== undefined && (taken.sendId !== send.props.sendId || taken.part !== part)) throw new Error("provider id already linked");
        s().outgoingParts.set(key, { sendId: send.props.sendId, part });
      }
      s().sends.set(stored.sendId, { ...stored, parts: stored.parts.map((x) => (x.index === part ? found : x)) });
    },
    async saveSend(send) {
      const stored = s().sends.get(send.props.sendId);
      if (stored === undefined) throw new Error("no such send");
      const { state, failureReason, finishedAt, retryAt } = send.props;
      s().sends.set(stored.sendId, { ...stored, state, failureReason, finishedAt, retryAt });
    },
    async findByProviderId(provider, providerMessageId) {
      return s().outgoingParts.get(`${provider}:${providerMessageId}`) ?? null;
    },
    async markPendingAsUnknown() {
      let changed = 0;
      for (const [id, props] of s().sends) {
        if (props.state !== "pending") continue;
        const sent = OutgoingSend.rehydrate(props);
        sent.markPendingUnknown();
        s().sends.set(id, sent.props);
        changed++;
      }
      return changed;
    },
    async candidatesForPart(chat, text, since) {
      return [...s().messages.values()]
        .filter((m) => {
          const p = m.message.props;
          return p.chat === chat && p.source === "owner_app" && p.text === text && p.sentAt >= since && !s().outgoingParts.has(messageIdKey(p.id));
        })
        .sort(bySent)
        .map((m) => m.message.props.id);
    },
  };
}
