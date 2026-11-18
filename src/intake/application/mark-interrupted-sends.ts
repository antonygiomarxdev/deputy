import type { OwnerLease } from "../../shared/owner-lease";
import { LeaseLostError, type IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import type { MarkInterruptedSends } from "../ports/mark-interrupted-sends";

/**
 * At start, a send still `pending` was cut off by a stop or a crash: it may or may not have reached the provider.
 * It becomes `unknown`, never `pending`, so the owner decides (FindOutgoing can link it later).
 */
export class MarkInterruptedSendsUseCase implements MarkInterruptedSends {
  constructor(private readonly d: { lease: OwnerLease; unitOfWork: IntakeUnitOfWork }) {}

  async execute(): Promise<{ marked: number }> {
    if (!(await this.d.lease.isOwner())) return { marked: 0 };
    try {
      return { marked: await this.d.unitOfWork.run((r) => r.outgoing.markPendingAsUnknown()) };
    } catch (e) {
      if (e instanceof LeaseLostError) return { marked: 0 };
      throw e;
    }
  }
}
