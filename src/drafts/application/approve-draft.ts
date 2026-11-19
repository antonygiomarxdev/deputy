import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import type { Approval } from "../domain/approval";
import { isClosed, isInFlight, type Draft } from "../domain/draft";
import { LogUnavailable } from "../domain/errors";
import { toLogEntries } from "../domain/log-mapper";
import type { Refusal } from "../domain/refusals";
import type { ApproveDraft, ApproveResult, Outcome } from "../ports/inbound";
import type { CustomerTextCheck } from "../ports/chat";
import type { Ids, TextDigest } from "../ports/crypto";
import type { OrderRecorder } from "../ports/orders";
import type { UnitOfWork } from "../ports/store";
import type { Sender } from "../ports/sender";
import { checkOwnerWords } from "./check-owner-words";
import type { PendingOutcomes } from "./pending-outcomes";
import { refuse, refusalOfError } from "./refusal-of-error";
import { driveSend } from "./send-pipeline";

export class ApproveDraftUseCase implements ApproveDraft {
  constructor(
    private readonly deps: {
      clock: Clock;
      lease: OwnerLease;
      unitOfWork: UnitOfWork;
      customerText: CustomerTextCheck;
      sender: Sender;
      recorder: OrderRecorder;
      pending: PendingOutcomes;
      digest: TextDigest;
      ids: Ids;
    },
  ) {}

  async run(input: Parameters<ApproveDraft["run"]>[0]): Promise<Outcome<ApproveResult>> {
    const { clock, lease, unitOfWork, digest, ids } = this.deps;
    const { number, shownText } = input;
    // trimmed once here, as change and reject do: the trimmed words are the ones the rule checks and the approval stores
    const ownerWords = input.ownerWords.trim();
    if (!(await lease.isOwner())) return refuse({ code: "not_owner" });

    const first = await unitOfWork.read((tx) => tx.drafts.get(number));
    if (first === null) return refuse({ code: "draft_not_found", number });
    const refused = this.refusalOfState(first, shownText);
    if (refused) return refuse(refused);
    const words = await checkOwnerWords(this.deps, ownerWords, number);
    if (words) return refuse(words);

    let committed: { draft: Draft; approval: Approval; approvalEntryId: number };
    try {
      const out = await unitOfWork.run(async (tx): Promise<Outcome<typeof committed>> => {
        const draft = await tx.drafts.get(number);
        if (draft === null) return refuse({ code: "draft_not_found", number });
        const stale = this.refusalOfState(draft, shownText);
        if (stale) return refuse(stale);
        const now = clock.now();
        const approvalId = ids.next();
        const approved = draft.approve({ shownText, ownerWords, approvalId, sendId: `deputy:${approvalId}`, textHash: digest.sha256(shownText), now });
        if (!approved.ok) return refuse({ code: "stale_draft", number });
        const started = draft.startSending(now);
        if (!started.ok) return refuse({ code: "stale_draft", number });
        // the revision compare comes first, so a second caller fails before anything else is written
        await tx.drafts.save(draft);
        await tx.approvals.insert(approved.approval);
        const [approvedId] = await tx.log.append(toLogEntries(approved.events, { approvalEntryId: null }));
        if (approvedId === undefined) throw new LogUnavailable("no entry id returned");
        await tx.log.append(toLogEntries(started.events, { approvalEntryId: approvedId }));
        return { ok: true, value: { draft, approval: approved.approval, approvalEntryId: approvedId } };
      });
      if (!out.ok) return out;
      committed = out.value;
    } catch (e) {
      return refusalOfError(e);
    }
    return driveSend(
      { ...this.deps, send: (chat, text, sendId) => this.deps.sender.send(chat, text, sendId) },
      committed.draft.snapshot(),
      committed.approval,
      committed.approvalEntryId,
    );
  }

  /** The state checks of step 1, in order. Repeated inside transaction 1, where another caller may have won. */
  private refusalOfState(draft: Draft, shownText: string): Refusal | null {
    const s = draft.snapshot();
    if (isInFlight(s.state)) return { code: "send_in_progress", number: s.number };
    if (isClosed(s.state)) {
      return { code: "not_approvable", number: s.number, state: s.state };
    }
    if (s.shownVersion !== s.textVersion) return { code: "not_shown", number: s.number };
    if (shownText !== s.currentText) return { code: "text_differs", number: s.number };
    return null;
  }
}
