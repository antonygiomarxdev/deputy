import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { parseOwnerWords } from "../../shared/owner-words";
import type { ChangeDraft, ChangeDraftResult, Outcome } from "../ports/inbound";
import type { OrderPreparer } from "../ports/orders";
import type { UnitOfWork } from "../ports/store";
import { applyDraftChange } from "./apply-draft-change";
import { refuse, refusalOfError } from "./refusal-of-error";

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
        const applied = await applyDraftChange(tx, clock, number, (draft, now) =>
          draft.changeText({ text, orderPayload, ownerWords: words, now }),
        );
        if (!applied.ok) return applied;
        return {
          ok: true,
          value: { number, state: "waiting", approvalVoided: applied.value.some((e) => e.type === "ApprovalVoided") },
        };
      });
    } catch (e) {
      return refusalOfError(e);
    }
  }
}
