import type { DraftEvent } from "./events";
import type { NewLogEntry } from "./log-entry";

export type LogContext = { readonly approvalEntryId: number | null };

/**
 * One entry per event, in order. The switch is exhaustive: a new DraftEvent member fails the typecheck
 * until its case exists. For an order draft proposedText and finalText are null.
 */
export function toLogEntries(events: readonly DraftEvent[], ctx: LogContext): NewLogEntry[] {
  return events.map((e): NewLogEntry => {
    const entry: NewLogEntry = {
      at: e.at,
      kind: "proposed",
      draft: e.draft,
      draftKind: e.draftKind,
      chat: e.chat,
      proposedText: null,
      finalText: null,
      reason: null,
      ownerWords: null,
      approvalEntryId: null,
      sendId: null,
      orderRef: null,
    };
    const texts = (proposed: string, final: string) =>
      e.draftKind === "order" ? {} : { proposedText: proposed, finalText: final };
    switch (e.type) {
      case "DraftProposed":
        return { ...entry, kind: "proposed", ...texts(e.text, e.text) };
      case "DraftReplaced":
        return { ...entry, kind: "replaced", reason: `replaced by ${e.replacedBy}` };
      case "TextChanged":
        return { ...entry, kind: "text_changed", ...texts(e.proposedText, e.newText), ownerWords: e.ownerWords };
      case "DraftRejected":
        return { ...entry, kind: "rejected", ownerWords: e.ownerWords };
      case "ApprovalVoided":
        return { ...entry, kind: "approval_voided", reason: e.reason, approvalEntryId: ctx.approvalEntryId };
    }
  });
}
