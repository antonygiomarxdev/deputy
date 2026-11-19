import type { ChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { Instant } from "../../shared/instant";
import type { Approval } from "../domain/approval";
import { Draft, type DraftChange, type DraftKind } from "../domain/draft";
import { LogUnavailable } from "../domain/errors";
import { toLogEntries } from "../domain/log-mapper";
import type { ApproveResult, Outcome } from "../ports/inbound";
import type { OrderRecorder } from "../ports/orders";
import type { UnitOfWork } from "../ports/store";
import type { PendingOutcomes } from "./pending-outcomes";
import { refuse, refusalOfError } from "./refusal-of-error";

/** The send as approve-draft.ts wires it. Typed here by its result kind only, so this file does not import the Sender port (FR-DRAFTS-02-7). */
export type SendFn = (chat: ChatId, text: string, sendId: string) => Promise<{ kind: string }>;

export type SendDeps = { clock: Clock; unitOfWork: UnitOfWork; send: SendFn; recorder: OrderRecorder; pending: PendingOutcomes };

/** What the outside call answered: how to close the draft, and what the owner is told. Null: the call was refused. */
export type Step = { finish: (d: Draft, now: Instant) => DraftChange; value: ApproveResult } | null;

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
  const sent = await deps.send(draft.chat, approval.text, approval.sendId);
  // a refused send was never attempted by this process, so the draft stays "sending" for the owner process to recover
  if (sent.kind === "refused") return null;
  if (sent.kind === "sent") return sentStep(number, approval.sendId);
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

/** The close of a send that went out: the draft becomes "sent". Also what the retry of an unwritten record does. */
export function sentStep(number: number, sendId: string): NonNullable<Step> {
  return {
    finish: (d, now) => d.finishSent({ sendId, now, reason: null }),
    value: { outcome: "sent", number, sendId, logged: true },
  };
}

/**
 * Transaction 4: reloads the draft, closes it with the step and logs the event, with the pointer to the approved entry.
 * Throws what the unit of work throws.
 */
export async function commit(
  deps: { clock: Clock; unitOfWork: UnitOfWork },
  number: number,
  step: NonNullable<Step>,
  approvalEntryId: number,
): Promise<Outcome<ApproveResult>> {
  return deps.unitOfWork.run(async (tx): Promise<Outcome<ApproveResult>> => {
    const loaded = await tx.drafts.get(number);
    if (loaded === null) return refuse({ code: "stale_draft", number });
    const finished = step.finish(loaded, deps.clock.now());
    if (!finished.ok) return refuse({ code: "stale_draft", number });
    await tx.drafts.save(loaded);
    await tx.log.append(toLogEntries(finished.events, { approvalEntryId }));
    return { ok: true, value: step.value };
  });
}

/** Waits before each retry of the `sent` write: now, after 1 second, after 3 seconds in all. */
const SENT_WRITE_WAITS_MS = [0, 1_000, 2_000];

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
  if (step.value.outcome !== "sent") {
    try {
      return await commit(deps, draft.number, step, approvalEntryId);
    } catch (e) {
      return refusalOfError(e);
    }
  }
  // the message went out and is never sent again: a record that cannot be written is retried, then left pending
  for (const wait of SENT_WRITE_WAITS_MS) {
    if (wait > 0) await deps.clock.sleep(wait);
    try {
      return await commit(deps, draft.number, step, approvalEntryId);
    } catch (e) {
      if (!(e instanceof LogUnavailable)) return refusalOfError(e);
    }
  }
  deps.pending.add({ draft: draft.number, sendId: approval.sendId, approvalEntryId });
  return { ok: true, value: { outcome: "sent", number: draft.number, sendId: approval.sendId, logged: false } };
}
