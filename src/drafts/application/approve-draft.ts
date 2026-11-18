import type { ChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import type { Approval } from "../domain/approval";
import { Draft } from "../domain/draft";
import { LeaseLost, LogUnavailable, StaleDraft } from "../domain/errors";
import { toLogEntries } from "../domain/log-mapper";
import type { Refusal } from "../domain/refusals";
import type { ApproveDraft, ApproveResult, Outcome } from "../ports/inbound";
import type { CustomerTextCheck, Ids, TextDigest, UnitOfWork } from "../ports/outbound";
import type { Sender } from "../ports/sender";
import { checkOwnerWords } from "./check-owner-words";

const refuse = (refusal: Refusal): Outcome<never> => ({ ok: false, refusal });

/** Maps the errors a unit of work throws to the refusal the owner sees. Anything else is a bug and propagates. */
function refusalOfError(e: unknown): Outcome<never> {
  if (e instanceof LogUnavailable) return refuse({ code: "log_unavailable" });
  if (e instanceof StaleDraft) return refuse({ code: "stale_draft", number: e.draft });
  if (e instanceof LeaseLost) return refuse({ code: "not_owner" });
  throw e;
}

type SendDeps = { clock: Clock; unitOfWork: UnitOfWork; sender: Sender };

/**
 * After transaction 1 has committed: sends the approved text, then records the result in one transaction.
 * The one send pipeline; SPEC-03's RetrySend reuses it without importing Sender.
 */
export async function driveSend(
  deps: SendDeps,
  draft: { number: number; chat: ChatId },
  approval: Approval,
  approvalEntryId: number,
): Promise<Outcome<ApproveResult>> {
  const sent = await deps.sender.send(draft.chat, approval.text, approval.sendId);
  // a refused send was never attempted by this process, so the draft stays "sending" for the owner process to recover
  if (sent.kind === "refused") return refuse({ code: "not_owner" });
  try {
    return await deps.unitOfWork.run(async (tx): Promise<Outcome<ApproveResult>> => {
      const loaded = await tx.drafts.get(draft.number);
      if (loaded === null) return refuse({ code: "stale_draft", number: draft.number });
      const now = deps.clock.now();
      // any result other than sent is "unknown": it is never retried by itself (TP-03)
      const finished =
        sent.kind === "sent"
          ? loaded.finishSent({ sendId: approval.sendId, now, reason: null })
          : loaded.finishUnknown({ reason: "unknown_outcome", now });
      if (!finished.ok) return refuse({ code: "stale_draft", number: draft.number });
      await tx.drafts.save(loaded);
      await tx.log.append(toLogEntries(finished.events, { approvalEntryId }));
      if (sent.kind === "sent") {
        return { ok: true, value: { outcome: "sent", number: draft.number, sendId: approval.sendId, logged: true } };
      }
      return {
        ok: true,
        value: {
          outcome: "unknown",
          number: draft.number,
          reason: "unknown_outcome",
          detail: "the message may or may not have been sent; check the chat before you decide",
        },
      };
    });
  } catch (e) {
    return refusalOfError(e);
  }
}

export class ApproveDraftUseCase implements ApproveDraft {
  constructor(
    private readonly deps: {
      clock: Clock;
      lease: OwnerLease;
      unitOfWork: UnitOfWork;
      customerText: CustomerTextCheck;
      sender: Sender;
      digest: TextDigest;
      ids: Ids;
    },
  ) {}

  async run(input: Parameters<ApproveDraft["run"]>[0]): Promise<Outcome<ApproveResult>> {
    const { clock, lease, unitOfWork, digest, ids } = this.deps;
    const { number, shownText, ownerWords } = input;
    if (!(await lease.isOwner())) return refuse({ code: "not_owner" });

    const first = await unitOfWork.read((tx) => tx.drafts.get(number));
    if (first === null) return refuse({ code: "draft_not_found", number });
    const refused = this.refusalOfState(first, shownText);
    if (refused) return refuse(refused);
    if (first.snapshot().kind === "order") return refuse({ code: "wrong_kind", number }); // order drafts are SPEC-02 Task 4
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
    return driveSend(this.deps, committed.draft.snapshot(), committed.approval, committed.approvalEntryId);
  }

  /** The state checks of step 1, in order. Repeated inside transaction 1, where another caller may have won. */
  private refusalOfState(draft: Draft, shownText: string): Refusal | null {
    const s = draft.snapshot();
    if (s.state === "sending" || s.state === "recording") return { code: "send_in_progress", number: s.number };
    if (s.state === "sent" || s.state === "recorded" || s.state === "rejected" || s.state === "replaced") {
      return { code: "not_approvable", number: s.number, state: s.state };
    }
    if (s.shownVersion !== s.textVersion) return { code: "not_shown", number: s.number };
    if (shownText !== s.currentText) return { code: "text_differs", number: s.number };
    return null;
  }
}
