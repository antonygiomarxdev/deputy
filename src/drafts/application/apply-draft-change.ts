import type { Clock } from "../../shared/clock";
import type { Instant } from "../../shared/instant";
import type { Draft, DraftChange } from "../domain/draft";
import type { DraftEvent } from "../domain/events";
import { toLogEntries } from "../domain/log-mapper";
import type { Outcome } from "../ports/inbound";
import type { Transaction } from "../ports/outbound";
import { refusalOfChange } from "./draft-change-refusal";
import { refuse } from "./refusal-of-error";
import { voidApprovals, withLiveApproval } from "./live-approval";

/**
 * The write the owner's changes share: load the draft with its live approval, apply the change, save, void the
 * approval the events void, and log the events. Returns the events; the caller shapes its own result.
 */
export async function applyDraftChange(
  tx: Pick<Transaction, "drafts" | "approvals" | "log">,
  clock: Clock,
  number: number,
  change: (draft: Draft, now: Instant) => DraftChange,
): Promise<Outcome<readonly DraftEvent[]>> {
  const loaded = await tx.drafts.get(number);
  if (loaded === null) return refuse({ code: "draft_not_found", number });
  const draft = await withLiveApproval(tx, loaded);
  const before = draft.snapshot();
  const now = clock.now();
  const changed = change(draft, now);
  if (!changed.ok) return refuse(refusalOfChange(number, before.state, changed.reason));
  await tx.drafts.save(draft);
  const approvalEntryId = await voidApprovals(tx, changed.events, number, now);
  await tx.log.append(toLogEntries(changed.events, { approvalEntryId }));
  return { ok: true, value: changed.events };
}
