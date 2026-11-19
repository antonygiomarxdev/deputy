import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { parseOwnerWords } from "../../shared/owner-words";
import type { Outcome, RejectDraft } from "../ports/inbound";
import type { UnitOfWork } from "../ports/outbound";
import { applyDraftChange } from "./apply-draft-change";
import { refuse, refusalOfError } from "./refusal-of-error";

export class RejectDraftUseCase implements RejectDraft {
  constructor(private readonly deps: { clock: Clock; lease: OwnerLease; unitOfWork: UnitOfWork }) {}

  async run(input: Parameters<RejectDraft["run"]>[0]): Promise<Outcome<{ number: number; state: "rejected" }>> {
    const { clock, lease, unitOfWork } = this.deps;
    if (!(await lease.isOwner())) return refuse({ code: "not_owner" });
    const words = parseOwnerWords(input.ownerWords);
    if (words === null) return refuse({ code: "words_empty" });
    const number = input.number;
    try {
      return await unitOfWork.run(async (tx): Promise<Outcome<{ number: number; state: "rejected" }>> => {
        const applied = await applyDraftChange(tx, clock, number, (draft, now) => draft.reject({ ownerWords: words, now }));
        if (!applied.ok) return applied;
        return { ok: true, value: { number, state: "rejected" } };
      });
    } catch (e) {
      return refusalOfError(e);
    }
  }
}
