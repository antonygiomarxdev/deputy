import type { DraftChange, DraftState } from "../domain/draft";
import type { Refusal } from "../domain/refusals";

/** Maps the domain's refusal of a change to the owner-facing one. */
export function refusalOfChange(
  number: number,
  state: DraftState,
  reason: Exclude<DraftChange, { ok: true }>["reason"],
): Refusal {
  switch (reason) {
    case "closed":
      return { code: "draft_closed", number, state };
    case "in_flight":
      return { code: "send_in_progress", number };
    case "unknown_open":
      return { code: "outcome_unknown_open", number };
    case "empty_text":
      return { code: "empty_text" };
  }
}
