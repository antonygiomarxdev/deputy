import { ApprovalAudit } from "../domain/approval-audit";
import type { CheckApprovals } from "../ports/inbound";
import type { UnitOfWork } from "../ports/store";

export class CheckApprovalsUseCase implements CheckApprovals {
  constructor(private readonly deps: { unitOfWork: UnitOfWork }) {}

  async run(): ReturnType<CheckApprovals["run"]> {
    const { rows, stuck } = await this.deps.unitOfWork.read(async (tx) => ({ rows: await tx.log.sentWithApproval(), stuck: await tx.log.stuckDrafts() }));
    return ApprovalAudit.audit(rows, stuck);
  }
}
