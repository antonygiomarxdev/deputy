import { parseChatId } from "../../shared/chat-id";
import { messageIdKey } from "../../shared/message-id";
import type { Instant } from "../../shared/instant";
import type { OwnerLease } from "../../shared/owner-lease";
import type { DraftSnapshot } from "../domain/draft";
import { LeaseLost, StaleDraft } from "../domain/errors";
import type { Refusal } from "../domain/refusals";
import { toIso } from "../domain/time";
import type { DraftView, ListDrafts, MessageView, Outcome } from "../ports/inbound";
import type { ChatReader, OrderPreparer, UnitOfWork } from "../ports/outbound";

const refuse = (refusal: Refusal): Outcome<never> => ({ ok: false, refusal });

export class ListDraftsUseCase implements ListDrafts {
  constructor(
    private readonly deps: { lease: OwnerLease; unitOfWork: UnitOfWork; chats: ChatReader; orders: OrderPreparer; sessionStartedAt: Instant },
  ) {}

  async run(input: { chat?: string }): Promise<Outcome<DraftView[]>> {
    const { lease, unitOfWork, chats, orders, sessionStartedAt } = this.deps;
    if (!(await lease.isOwner())) return refuse({ code: "not_owner" });
    let filter: { chat?: NonNullable<ReturnType<typeof parseChatId>> } = {};
    if (input.chat !== undefined) {
      const chat = parseChatId(input.chat);
      if (chat === null) return { ok: true, value: [] };
      filter = { chat };
    }

    let drafts: DraftSnapshot[];
    try {
      // listing writes the shown mark, so it runs under the lease
      drafts = await unitOfWork.run(async (tx) => {
        const open = await tx.drafts.listOpen(filter);
        for (const d of open) if (d.markShown()) await tx.drafts.save(d);
        return open.map((d) => d.snapshot());
      });
    } catch (e) {
      if (e instanceof LeaseLost) return refuse({ code: "not_owner" });
      if (e instanceof StaleDraft) return refuse({ code: "stale_draft", number: e.draft });
      throw e;
    }

    const views: DraftView[] = [];
    for (const d of drafts) {
      let answers: DraftView["answers"] = null;
      if (d.answers) {
        const m = await chats.message(d.chat, d.answers);
        answers = m ? ({ id: messageIdKey(m.id), sentAt: toIso(m.sentAt), text: m.text, source: m.source } satisfies MessageView) : { unavailable: true };
      }
      const catalogChanged = d.kind === "order" && d.orderPayload !== null ? (await orders.revalidate(d.orderPayload)).catalogChanged : false;
      views.push({
        number: d.number, kind: d.kind, chat: d.chat, state: d.state, text: d.currentText, madeAt: toIso(d.madeAt),
        answers, catalogChanged, holdReason: d.holdReason, failReason: d.failReason,
        fromEarlierSession: d.madeAt < sessionStartedAt,
        retryAt: d.retryAt === null ? null : toIso(d.retryAt),
      });
    }
    return { ok: true, value: views };
  }
}
