import type { ChatId } from "../../shared/chat-id";
import { UNATTRIBUTED_CHAT } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { PhoneNumber } from "../../shared/phone-number";
import type { SendId } from "../../shared/send-id";
import { RATE_LIMIT_DEFAULT_WAIT_MS } from "../domain/constants";
import { OutgoingSend, type SendFailure } from "../domain/outgoing-send";
import { LeaseLostError, type IntakeRepos, type IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import { ProviderError, type Provider, type ProviderMessage } from "../ports/provider";
import type { SendText, SendTextResult } from "../ports/send-text";
import type { StoreMessages } from "./store-messages";


const REFUSAL: Record<string, SendFailure> = { credentials: "credentials", unreachable: "unreachable", quota: "quota" };

/** What an earlier call with the same send id recorded: nothing is sent again. */
function recorded(send: OutgoingSend): SendTextResult {
  const p = send.props;
  const sent = p.parts.filter((x) => x.state === "sent");
  if (p.state === "sent") return { kind: "sent", providerMessageIds: sent.map((x) => x.providerMessageId ?? "") };
  if (p.state === "failed") {
    if (p.failureReason === "rate_limited") return { kind: "rate_limited", retryAt: p.retryAt ?? p.finishedAt ?? p.createdAt };
    const reason = p.failureReason;
    return { kind: "failed", reason: reason === "credentials" || reason === "unreachable" || reason === "quota" ? reason : "rejected" };
  }
  return { kind: "unknown", partsSent: sent.length, partsTotal: p.parts.length };
}

export interface SendTextDeps {
  lease: OwnerLease;
  provider: Provider;
  unitOfWork: IntakeUnitOfWork;
  store: StoreMessages;
  clock: Clock;
}

export class SendTextUseCase implements SendText {
  constructor(private readonly d: SendTextDeps) {}

  async execute(q: { sendId: SendId; chat: ChatId; text: string }): Promise<SendTextResult> {
    const { lease, provider, unitOfWork: uow, store, clock } = this.d;
    if (!(await lease.isOwner())) return { kind: "refused", reason: "not_owner" };
    if (q.text.trim() === "") return { kind: "failed", reason: "rejected" };

    let start: { result: SendTextResult } | { send: OutgoingSend; to: PhoneNumber; from: string | null; providerId: string };
    try {
      start = await uow.run(async (r) => {
        const dest = await this.destination(r, q.chat);
        if (dest === null) return { result: { kind: "failed", reason: "unsupported_chat" } as const };
        const existing = await r.outgoing.find(q.sendId);
        if (existing !== null) return { result: recorded(existing) };
        const send = OutgoingSend.create({ sendId: q.sendId, chat: q.chat, text: q.text, createdAt: clock.now() });
        await r.outgoing.insert(send);
        return { send, ...dest };
      });
    } catch (e) {
      if (e instanceof LeaseLostError) return { kind: "refused", reason: "not_owner" };
      throw e;
    }
    if ("result" in start) return start.result;
    const { send, to, from, providerId } = start;

    for (const part of send.props.parts) {
      let accepted: { providerMessageId: string; serverTime: number };
      try {
        accepted = await provider.sendText({ to, text: part.text }, new AbortController().signal);
      } catch (e) {
        const err = e instanceof ProviderError ? e : null;
        return this.stopped(send, part.index, err, clock.now());
      }
      try {
        await uow.run(async (r) => {
          send.partSent(part.index, accepted.providerMessageId);
          await r.outgoing.savePart(send, part.index, provider.name);
          // the part row holds the id now, so the message is stored as sent_through_deputy (or an early echo is reclassified)
          await store.store(r, { provider: provider.name, events: [{ kind: "message", message: this.message(part.text, accepted, from, providerId) }] });
        });
      } catch (e) {
        // the provider accepted the part but it was not recorded: the safe reading is that it may have gone out
        console.error(`deputy: recording a sent part failed (${e instanceof Error ? e.name : "unknown error"})`);
        return this.stopped(send, part.index, null, clock.now());
      }
    }

    send.markAllSentIfComplete(clock.now());
    await this.persist(send, provider.name);
    return recorded(send);
  }

  /** The chat's destination, or null when the chat is not one a send can go to. */
  private async destination(
    r: IntakeRepos,
    chat: ChatId,
  ): Promise<{ to: PhoneNumber; from: string | null; providerId: string } | null> {
    if (chat === UNATTRIBUTED_CHAT || chat.startsWith("group:")) return null;
    const dev = this.d.provider.name === "dev";
    if (!dev && !(await r.messages.chatExists(chat)).hasNonDevMessage) return null;
    const state = await r.chats.get(chat, dev);
    const providerId = state?.providerId ?? null;
    const to = providerId === null ? null : PhoneNumber.fromInternational(providerId);
    if (providerId === null || to === null) return null;
    const business = (await r.owners.load()).business();
    return { to, from: business?.number.digits ?? null, providerId };
  }

  private message(text: string, accepted: { providerMessageId: string; serverTime: number }, from: string | null, providerId: string): ProviderMessage {
    return {
      providerMessageId: accepted.providerMessageId,
      conversationRef: null,
      from,
      counterpart: providerId,
      direction: "outbound",
      type: "text",
      text,
      transcript: null,
      sentAt: accepted.serverTime,
      origin: null,
      group: false,
      edited: false,
      profileName: null,
      devOwnerMark: false,
    };
  }

  /** A part failed or was interrupted: record the send and say what is known. `err` null means the outcome is unknown. */
  private async stopped(send: OutgoingSend, index: number, err: ProviderError | null, now: number): Promise<SendTextResult> {
    if (err?.kind === "rate_limited" && index === 1) {
      const retryAt = now + (err.retryAfterMs ?? RATE_LIMIT_DEFAULT_WAIT_MS);
      send.failNothingAccepted("rate_limited", now, retryAt);
      await this.persist(send, this.d.provider.name);
      return { kind: "rate_limited", retryAt };
    }
    if (err !== null && !err.mayHaveBeenAccepted && index === 1) {
      const reason: SendFailure = REFUSAL[err.kind] ?? "rejected";
      send.failNothingAccepted(reason, now);
      await this.persist(send, this.d.provider.name);
      return recorded(send);
    }
    send.interrupt({ index, mayHaveBeenAccepted: err === null || err.mayHaveBeenAccepted, at: now });
    await this.persist(send, this.d.provider.name);
    return recorded(send);
  }

  private async persist(send: OutgoingSend, provider: Provider["name"]): Promise<void> {
    try {
      await this.d.unitOfWork.run(async (r) => {
        for (const part of send.props.parts) await r.outgoing.savePart(send, part.index, provider);
        await r.outgoing.saveSend(send);
      });
    } catch (e) {
      // what happened is already known; the row stays pending and MarkInterruptedSends turns it into unknown at the next start
      console.error(`deputy: recording the outcome of a send failed (${e instanceof Error ? e.name : "unknown error"})`);
    }
  }
}
