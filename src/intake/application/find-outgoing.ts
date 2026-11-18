import type { ChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { Instant } from "../../shared/instant";
import type { MessageId } from "../../shared/message-id";
import type { OwnerLease } from "../../shared/owner-lease";
import type { SendId } from "../../shared/send-id";
import { OUTGOING_SKEW_MS } from "../domain/constants";
import { splitText } from "../domain/split-text";
import type { FindOutgoing, FindOutgoingResult } from "../ports/find-outgoing";
import { LeaseLostError, type IntakeUnitOfWork } from "../ports/intake-unit-of-work";

/**
 * After an unknown send (Drafts calls it after a catch-up): does the provider's own report hold every part of it?
 * It makes no provider call. It links only when every part has exactly one candidate.
 */
export class FindOutgoingUseCase implements FindOutgoing {
  constructor(private readonly d: { lease: OwnerLease; unitOfWork: IntakeUnitOfWork; clock: Clock }) {}

  async execute(q: { sendId: SendId; chat: ChatId; since: Instant; text: string }): Promise<FindOutgoingResult> {
    if (!(await this.d.lease.isOwner())) return { kind: "refused", reason: "not_owner" };
    try {
      return await this.d.unitOfWork.run(async (r): Promise<FindOutgoingResult> => {
        const send = await r.outgoing.find(q.sendId);
        if (send === null || send.props.chat !== q.chat) return { kind: "none" };
        if (send.props.state === "sent") {
          return { kind: "found", providerMessageIds: send.props.parts.map((p) => p.providerMessageId ?? "") };
        }
        // a failed send never reached the provider (the state machine has no way from failed to sent)
        if (send.props.state !== "unknown") return { kind: "none" };

        const parts = splitText(q.text);
        if (parts.length !== send.props.parts.length) return { kind: "none" };
        const candidates: MessageId[][] = [];
        for (const part of parts) candidates.push(await r.outgoing.candidatesForPart(q.chat, part, q.since - OUTGOING_SKEW_MS));

        // ambiguous, then partial, then none (SPEC-04 Context point 4)
        const most = Math.max(...candidates.map((c) => c.length));
        if (most > 1) return { kind: "ambiguous", candidates: most };
        const found = candidates.filter((c) => c.length === 1).length;
        if (found === 0) return { kind: "none" };
        if (found < parts.length) return { kind: "partial", found, expected: parts.length };

        const now = this.d.clock.now();
        const ids: string[] = [];
        let dev = false;
        for (const [i, list] of candidates.entries()) {
          const id = list[0];
          if (id === undefined) continue;
          const message = await r.messages.find(id);
          const changed = message?.reclassifyAsDeputySend(q.sendId, now);
          if (message === null || changed === undefined || !changed.ok) return { kind: "none" };
          await r.messages.reclassify(id, changed.change);
          send.linkPart(i + 1, id.providerMessageId, now);
          await r.outgoing.savePart(send, i + 1, id.provider);
          ids.push(id.providerMessageId);
          dev = message.props.dev;
        }
        await r.outgoing.saveSend(send);
        await r.chats.recompute(q.chat, dev, now, { providerId: null, conversationRef: null });
        return { kind: "found", providerMessageIds: ids };
      });
    } catch (e) {
      if (e instanceof LeaseLostError) return { kind: "refused", reason: "not_owner" };
      throw e;
    }
  }
}
