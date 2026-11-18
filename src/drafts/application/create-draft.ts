import { parseChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import { messageIdKey } from "../../shared/message-id";
import type { OwnerLease } from "../../shared/owner-lease";
import { Draft } from "../domain/draft";
import type { DraftEvent } from "../domain/events";
import { LeaseLost, LogUnavailable, StaleDraft } from "../domain/errors";
import { toLogEntries } from "../domain/log-mapper";
import type { Refusal } from "../domain/refusals";
import { toIso } from "../domain/time";
import { voidApprovals, withLiveApproval } from "./live-approval";
import type { CreateDraft, CreateDraftResult, MessageView, Outcome } from "../ports/inbound";
import type { ChatMessage, ChatReader, OrderPreparer, UnitOfWork } from "../ports/outbound";

const refuse = (refusal: Refusal): Outcome<never> => ({ ok: false, refusal });

const view = (m: ChatMessage): MessageView => ({ id: messageIdKey(m.id), sentAt: toIso(m.sentAt), text: m.text, source: m.source });

export class CreateDraftUseCase implements CreateDraft {
  constructor(
    private readonly deps: { clock: Clock; lease: OwnerLease; unitOfWork: UnitOfWork; chats: ChatReader; orders: OrderPreparer },
  ) {}

  async run(input: Parameters<CreateDraft["run"]>[0]): Promise<Outcome<CreateDraftResult>> {
    const { clock, lease, unitOfWork, chats, orders } = this.deps;
    if (!(await lease.isOwner())) return refuse({ code: "not_owner" });
    const chat = parseChatId(input.chat);
    if (chat === null) return refuse({ code: "chat_not_found" });
    if (input.kind === "reply" && input.text.trim() === "") return refuse({ code: "empty_text" });

    const checkedStoredAt = clock.now(); // before describe: anything stored after this is "new since the draft"
    const info = await chats.describe(chat);
    if (info === null) return refuse({ code: "chat_not_found" });
    if (!info.hasCustomerMessage || info.latest === null) return refuse({ code: "no_customer_message" });
    if (!info.activeWorldIsDev && !info.hasNonDevMessage) return refuse({ code: "dev_messages_only" });

    let text: string;
    let orderPayload: string | null = null;
    if (input.kind === "reply") {
      text = input.text;
    } else {
      const prepared = await orders.prepare(chat, input.order);
      if (!prepared.ok) return refuse({ code: "order_rejected", reasons: prepared.reasons });
      text = prepared.summary;
      orderPayload = prepared.payload;
    }
    const latest = info.latest;
    const answered = input.kind === "reply" ? info.latestCustomer : null;

    try {
      return await unitOfWork.run(async (tx): Promise<Outcome<CreateDraftResult>> => {
        const open = await tx.drafts.openFor(chat, input.kind);
        const existing = open === null ? null : await withLiveApproval(tx, open);
        const before = existing?.snapshot();
        if (before?.state === "sending" || before?.state === "recording") {
          return refuse({ code: "send_in_progress", number: before.number });
        }
        if (before?.state === "unknown") return refuse({ code: "outcome_unknown_open", number: before.number });

        let replacedState: "waiting" | "held" | "failed" | null = null;
        if (before) {
          if (before.state !== "waiting" && before.state !== "held" && before.state !== "failed") {
            return refuse({ code: "draft_closed", number: before.number, state: before.state });
          }
          replacedState = before.state;
        }

        const now = clock.now();
        const number = await tx.drafts.nextNumber();
        const proposed = Draft.propose({
          number, kind: input.kind, chat, text, now, dev: info.activeWorldIsDev, answers: answered?.id ?? null,
          basis: { messageId: latest.id, sentAt: latest.sentAt }, checkedStoredAt, orderPayload,
        });
        if (!("draft" in proposed)) return refuse({ code: "empty_text" });

        const events: DraftEvent[] = [];
        let approvalEntryId: number | null = null;
        if (existing && before) {
          const replaced = existing.replaceBy({ number, now });
          if (!replaced.ok) return refuse({ code: "stale_draft", number: before.number });
          // the old draft is saved first: it leaves the one-open-draft index before the new one enters it
          await tx.drafts.save(existing);
          events.push(...replaced.events);
          approvalEntryId = await voidApprovals(tx, replaced.events, before.number, now);
        }
        await tx.drafts.save(proposed.draft);
        events.push(...proposed.events);
        await tx.log.append(toLogEntries(events, { approvalEntryId }));

        return {
          ok: true,
          value: {
            number, kind: input.kind, state: "waiting", chat, madeAt: now, text,
            answers: answered ? view(answered) : null,
            replaced: before && replacedState ? { number: before.number, state: replacedState } : null,
          },
        };
      });
    } catch (e) {
      if (e instanceof LogUnavailable) return refuse({ code: "log_unavailable" });
      if (e instanceof StaleDraft) return refuse({ code: "stale_draft", number: e.draft });
      if (e instanceof LeaseLost) return refuse({ code: "not_owner" });
      throw e;
    }
  }
}
