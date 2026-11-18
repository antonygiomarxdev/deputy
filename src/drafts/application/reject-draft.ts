import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { parseOwnerWords } from "../../shared/owner-words";
import { LeaseLost, LogUnavailable, StaleDraft } from "../domain/errors";
import { toLogEntries } from "../domain/log-mapper";
import type { Refusal } from "../domain/refusals";
import type { Outcome, RejectDraft } from "../ports/inbound";
import type { UnitOfWork } from "../ports/outbound";
import { refusalOfChange } from "./draft-change-refusal";
import { voidApprovals, withLiveApproval } from "./live-approval";

const refuse = (refusal: Refusal): Outcome<never> => ({ ok: false, refusal });

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
        const loaded = await tx.drafts.get(number);
        if (loaded === null) return refuse({ code: "draft_not_found", number });
        const draft = await withLiveApproval(tx, loaded);
        const before = draft.snapshot();
        const now = clock.now();
        const rejected = draft.reject({ ownerWords: words, now });
        if (!rejected.ok) return refuse(refusalOfChange(number, before.state, rejected.reason));
        await tx.drafts.save(draft);
        const approvalEntryId = await voidApprovals(tx, rejected.events, number, now);
        await tx.log.append(toLogEntries(rejected.events, { approvalEntryId }));
        return { ok: true, value: { number, state: "rejected" } };
      });
    } catch (e) {
      if (e instanceof LogUnavailable) return refuse({ code: "log_unavailable" });
      if (e instanceof StaleDraft) return refuse({ code: "stale_draft", number: e.draft });
      if (e instanceof LeaseLost) return refuse({ code: "not_owner" });
      throw e;
    }
  }
}
