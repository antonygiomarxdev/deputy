import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { parseOwnerWords } from "../../shared/owner-words";
import { LeaseLost, LogUnavailable, StaleDraft } from "../domain/errors";
import { toLogEntries } from "../domain/log-mapper";
import type { Refusal } from "../domain/refusals";
import type { ChangeDraft, ChangeDraftResult, Outcome } from "../ports/inbound";
import type { OrderPreparer, UnitOfWork } from "../ports/outbound";
import { refusalOfChange } from "./draft-change-refusal";
import { voidApprovals, withLiveApproval } from "./live-approval";

const refuse = (refusal: Refusal): Outcome<never> => ({ ok: false, refusal });

export class ChangeDraftUseCase implements ChangeDraft {
  constructor(private readonly deps: { clock: Clock; lease: OwnerLease; unitOfWork: UnitOfWork; orders: OrderPreparer }) {}

  async run(input: Parameters<ChangeDraft["run"]>[0]): Promise<Outcome<ChangeDraftResult>> {
    const { clock, lease, unitOfWork, orders } = this.deps;
    if (!(await lease.isOwner())) return refuse({ code: "not_owner" });
    const words = parseOwnerWords(input.ownerWords);
    if (words === null) return refuse({ code: "words_empty" });
    const number = input.number;
    try {
      // The kind decides what to prepare; the order is prepared before the write, as CreateDraft does.
      const first = await unitOfWork.run((tx) => tx.drafts.get(number), { requireLease: false });
      if (first === null) return refuse({ code: "draft_not_found", number });
      const { kind, chat } = first.snapshot();
      const fits = kind === "reply" ? input.text !== undefined && input.order === undefined : input.order !== undefined && input.text === undefined;
      if (!fits) return refuse({ code: "wrong_kind", number });
      let text = input.text ?? "";
      let orderPayload: string | null = null;
      if (kind === "order" && input.order !== undefined) {
        const prepared = await orders.prepare(chat, input.order);
        if (!prepared.ok) return refuse({ code: "order_rejected", reasons: prepared.reasons });
        text = prepared.summary;
        orderPayload = prepared.payload;
      }

      return await unitOfWork.run(async (tx): Promise<Outcome<ChangeDraftResult>> => {
        const loaded = await tx.drafts.get(number);
        if (loaded === null) return refuse({ code: "draft_not_found", number });
        const draft = await withLiveApproval(tx, loaded);
        const before = draft.snapshot();
        const now = clock.now();
        const changed = draft.changeText({ text, orderPayload, ownerWords: words, now });
        if (!changed.ok) return refuse(refusalOfChange(number, before.state, changed.reason));
        await tx.drafts.save(draft);
        const approvalEntryId = await voidApprovals(tx, changed.events, number, now);
        await tx.log.append(toLogEntries(changed.events, { approvalEntryId }));
        return {
          ok: true,
          value: { number, state: "waiting", approvalVoided: changed.events.some((e) => e.type === "ApprovalVoided") },
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
