import { parseChatId, type ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { OwnerLease } from "../../shared/owner-lease";
import type { DraftSnapshot } from "../domain/draft";
import { toIso } from "../domain/time";
import type { DraftView, ListDrafts, Outcome } from "../ports/inbound";
import { messageView } from "./message-view";
import { refuse, refusalOfError } from "./refusal-of-error";
import type { ChatReader, OrderPreparer, UnitOfWork } from "../ports/outbound";

export class ListDraftsUseCase implements ListDrafts {
  constructor(
    private readonly deps: { lease: OwnerLease; unitOfWork: UnitOfWork; chats: ChatReader; orders: OrderPreparer; sessionStartedAt: Instant },
  ) {}

  async run(input: { chat?: string }): Promise<Outcome<DraftView[]>> {
    if (!(await this.deps.lease.isOwner())) return refuse({ code: "not_owner" });
    let filter: { chat?: ChatId } = {};
    if (input.chat !== undefined) {
      const chat = parseChatId(input.chat);
      if (chat === null) return refuse({ code: "chat_not_found" });
      filter = { chat };
    }

    let drafts: DraftSnapshot[];
    try {
      drafts = await this.markShown(filter);
    } catch (e) {
      return refusalOfError(e);
    }

    const views: DraftView[] = [];
    for (const d of drafts) views.push(await this.viewOf(d));
    return { ok: true, value: views };
  }

  /** Listing writes the shown mark, so it is the only write here and it runs under the lease. */
  private markShown(filter: { chat?: ChatId }): Promise<DraftSnapshot[]> {
    return this.deps.unitOfWork.run(async (tx) => {
      const open = await tx.drafts.listOpen(filter);
      for (const d of open) if (d.markShown()) await tx.drafts.save(d);
      return open.map((d) => d.snapshot());
    });
  }

  private async viewOf(d: DraftSnapshot): Promise<DraftView> {
    const { chats, orders, sessionStartedAt } = this.deps;
    let answers: DraftView["answers"] = null;
    if (d.answers) {
      const m = await chats.message(d.chat, d.answers);
      answers = m ? messageView(m) : { unavailable: true };
    }
    const catalogChanged = d.kind === "order" && d.orderPayload !== null ? (await orders.revalidate(d.orderPayload)).catalogChanged : false;
    return {
      number: d.number, kind: d.kind, chat: d.chat, state: d.state, text: d.currentText, madeAt: toIso(d.madeAt),
      answers, catalogChanged, holdReason: d.holdReason, failReason: d.failReason,
      fromEarlierSession: d.madeAt < sessionStartedAt,
      retryAt: d.retryAt === null ? null : toIso(d.retryAt),
    };
  }
}
