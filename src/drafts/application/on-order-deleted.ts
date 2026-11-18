import { parseChatId, UNATTRIBUTED_CHAT } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { LeaseLost } from "../domain/errors";
import type { OnOrderDeleted } from "../ports/inbound";
import type { UnitOfWork } from "../ports/outbound";

export class OnOrderDeletedUseCase implements OnOrderDeleted {
  constructor(private readonly deps: { clock: Clock; lease: OwnerLease; unitOfWork: UnitOfWork }) {}

  async run(event: Parameters<OnOrderDeleted["run"]>[0]): ReturnType<OnOrderDeleted["run"]> {
    const { clock, lease, unitOfWork } = this.deps;
    // not the owner: nothing changes, so the Orders outbox delivers the event again to the owner
    if (!(await lease.isOwner())) return { refused: "not_owner" };
    try {
      return await unitOfWork.run(async (tx) => {
        // a second delivery of the same order finds its entry and does nothing
        if (await tx.log.hasOrderDeleted(event.orderId)) return { scrubbed: 0 };
        const scrubbed = await tx.log.scrubOrder(event.orderId, event.draftNumber);
        if (event.draftNumber !== null) {
          await tx.drafts.scrubOrderDraft(event.draftNumber);
          await tx.approvals.scrubOrderDraft(event.draftNumber);
        }
        await tx.log.append([
          {
            at: clock.now(), kind: "order_deleted", draft: null, draftKind: null, chat: parseChatId(event.chat) ?? UNATTRIBUTED_CHAT,
            proposedText: null, finalText: null, reason: null, ownerWords: null, approvalEntryId: null, sendId: null, orderRef: event.orderId,
          },
        ]);
        return { scrubbed };
      });
    } catch (e) {
      if (e instanceof LeaseLost) return { refused: "not_owner" };
      throw e;
    }
  }
}
