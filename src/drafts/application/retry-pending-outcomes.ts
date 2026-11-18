import type { Clock } from "../../shared/clock";
import { LeaseLost, LogUnavailable, StaleDraft } from "../domain/errors";
import type { RetryPendingOutcomes } from "../ports/inbound";
import type { UnitOfWork } from "../ports/outbound";
import { commit, sentStep } from "./approve-draft";
import type { PendingOutcomes } from "./pending-outcomes";

export class RetryPendingOutcomesUseCase implements RetryPendingOutcomes {
  constructor(private readonly deps: { clock: Clock; unitOfWork: UnitOfWork; pending: PendingOutcomes }) {}

  /** The owner's tick: tries the unwritten `sent` records again. A message that went out is never sent again. */
  async run(): ReturnType<RetryPendingOutcomes["run"]> {
    let written = 0;
    for (const item of this.deps.pending.list()) {
      try {
        const out = await commit(this.deps, item.draft, sentStep(item.draft, item.sendId), item.approvalEntryId);
        // a refusal here means the draft is no longer the one that was sending: there is nothing left to write
        this.deps.pending.remove(item.sendId);
        if (out.ok) written++;
      } catch (e) {
        if (!(e instanceof LogUnavailable || e instanceof LeaseLost || e instanceof StaleDraft)) throw e;
      }
    }
    return { written, pending: this.deps.pending.list().length };
  }
}
