import type { ChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { Instant } from "../../shared/instant";
import type { OwnerLease } from "../../shared/owner-lease";
import type { Approval } from "../domain/approval";
import { Draft, type DraftChange, type DraftKind } from "../domain/draft";
import { LeaseLost, LogUnavailable, StaleDraft } from "../domain/errors";
import { toLogEntries } from "../domain/log-mapper";
import type { Refusal } from "../domain/refusals";
import type { ApproveDraft, ApproveResult, Outcome } from "../ports/inbound";
import type { CustomerTextCheck, Ids, OrderRecorder, TextDigest, UnitOfWork } from "../ports/outbound";
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

type SendDeps = { clock: Clock; unitOfWork: UnitOfWork; sender: Sender; recorder: OrderRecorder };

/** What the outside call answered: how to close the draft, and what the owner is told. Null: the call was refused. */
type Step = { finish: (d: Draft, now: Instant) => DraftChange; value: ApproveResult } | null;

async function attempt(
  deps: SendDeps,
  draft: { number: number; chat: ChatId; kind: DraftKind; orderPayload: string | null },
  approval: Approval,
): Promise<Step> {
  const number = draft.number;
  if (draft.kind === "order") {
    // an order draft only ever reaches Orders: its summary is never sent to a customer
    if (draft.orderPayload === null) throw new Error(`order draft ${number} has no payload`);
    const r = await deps.recorder.record({ draftNumber: number, payload: draft.orderPayload, ownerWords: approval.ownerWords });
    if (r.ok) return { finish: (d, now) => d.finishRecorded({ orderId: r.orderId, now }), value: { outcome: "recorded", number, orderId: r.orderId } };
    if (r.kind === "outcome_unknown") {
      return {
        finish: (d, now) => d.finishUnknown({ reason: "order_outcome_unknown", now }),
        value: {
          outcome: "unknown",
          number,
          reason: "order_outcome_unknown",
          detail: "the order may or may not have been recorded; check the orders before you decide",
        },
      };
    }
    return { finish: (d, now) => d.finishFailed({ reason: r.reason, now }), value: { outcome: "failed", number, reason: r.reason } };
  }
  const sent = await deps.sender.send(draft.chat, approval.text, approval.sendId);
  // a refused send was never attempted by this process, so the draft stays "sending" for the owner process to recover
  if (sent.kind === "refused") return null;
  if (sent.kind === "sent") {
    return {
      finish: (d, now) => d.finishSent({ sendId: approval.sendId, now, reason: null }),
      value: { outcome: "sent", number, sendId: approval.sendId, logged: true },
    };
  }
  // any result other than sent is "unknown": it is never retried by itself (TP-03)
  return {
    finish: (d, now) => d.finishUnknown({ reason: "unknown_outcome", now }),
    value: {
      outcome: "unknown",
      number,
      reason: "unknown_outcome",
      detail: "the message may or may not have been sent; check the chat before you decide",
    },
  };
}

/**
 * After transaction 1 has committed: makes the outside call (the send, or Orders' record), then writes the result
 * in one transaction. The one send pipeline; SPEC-03's RetrySend reuses it without importing Sender.
 */
export async function driveSend(
  deps: SendDeps,
  draft: { number: number; chat: ChatId; kind: DraftKind; orderPayload: string | null },
  approval: Approval,
  approvalEntryId: number,
): Promise<Outcome<ApproveResult>> {
  const step = await attempt(deps, draft, approval);
  if (step === null) return refuse({ code: "not_owner" });
  try {
    return await deps.unitOfWork.run(async (tx): Promise<Outcome<ApproveResult>> => {
      const loaded = await tx.drafts.get(draft.number);
      if (loaded === null) return refuse({ code: "stale_draft", number: draft.number });
      const finished = step.finish(loaded, deps.clock.now());
      if (!finished.ok) return refuse({ code: "stale_draft", number: draft.number });
      await tx.drafts.save(loaded);
      await tx.log.append(toLogEntries(finished.events, { approvalEntryId }));
      return { ok: true, value: step.value };
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
      recorder: OrderRecorder;
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
