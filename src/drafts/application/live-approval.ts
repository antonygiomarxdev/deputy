import type { Instant } from "../../shared/instant";
import { Draft } from "../domain/draft";
import type { DraftEvent } from "../domain/events";
import type { Transaction } from "../ports/store";

/** The draft with its live (not voided) approval attached: the drafts row never stores it. */
export async function withLiveApproval(tx: Pick<Transaction, "approvals">, draft: Draft): Promise<Draft> {
  const snapshot = draft.snapshot();
  const live = (await tx.approvals.forDraft(snapshot.number)).filter((a) => a.voidedAt === null).at(-1);
  return live ? Draft.rehydrate({ ...snapshot, approval: live }) : draft;
}

/**
 * When the events void an approval: marks its rows voided and returns the id of the `approved` log entry
 * of that send, which the `approval_voided` entry points to. Null when no approval was voided.
 */
export async function voidApprovals(
  tx: Pick<Transaction, "approvals" | "log">,
  events: readonly DraftEvent[],
  draft: number,
  now: Instant,
): Promise<number | null> {
  const voided = events.find((e) => e.type === "ApprovalVoided");
  if (voided === undefined) return null;
  await tx.approvals.void(draft, voided.reason, now);
  return tx.log.approvalEntryIdFor(voided.sendId);
}
