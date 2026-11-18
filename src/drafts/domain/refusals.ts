import type { DraftState } from "./draft";

export type Refusal =
  | { readonly code: "not_owner" }
  | { readonly code: "chat_not_found" }
  | { readonly code: "no_customer_message" }
  | { readonly code: "dev_messages_only" }
  | { readonly code: "empty_text" }
  | { readonly code: "order_rejected"; readonly reasons: readonly string[] }
  | { readonly code: "send_in_progress"; readonly number: number }
  | { readonly code: "outcome_unknown_open"; readonly number: number }
  | { readonly code: "draft_not_found"; readonly number: number }
  | { readonly code: "draft_closed"; readonly number: number; readonly state: DraftState }
  | { readonly code: "wrong_kind"; readonly number: number }
  | { readonly code: "words_empty" }
  | { readonly code: "log_unavailable" }
  | { readonly code: "stale_draft"; readonly number: number };

/** English default text for each code (D20). No customer or provider text. */
export function refusalText(r: Refusal): string {
  switch (r.code) {
    case "not_owner":
      return "another Deputy session owns this data";
    case "chat_not_found":
      return "that chat does not exist";
    case "no_customer_message":
      return "that chat has no customer message";
    case "dev_messages_only":
      return "that chat has only test messages";
    case "empty_text":
      return "the draft text is empty";
    case "order_rejected":
      return `the order was refused: ${r.reasons.join("; ")}`;
    case "send_in_progress":
      return `draft ${r.number} is being sent`;
    case "outcome_unknown_open":
      return `draft ${r.number} has an unknown outcome: reject it first, or wait for it to resolve`;
    case "draft_not_found":
      return `draft ${r.number} does not exist`;
    case "draft_closed":
      return `draft ${r.number} is closed (${r.state})`;
    case "wrong_kind":
      return `draft ${r.number} is of the other kind`;
    case "words_empty":
      return "the owner's words are empty or longer than 1000 characters";
    case "log_unavailable":
      return "the drafts log cannot be written, so nothing was done";
    case "stale_draft":
      return `draft ${r.number} changed while this ran; list the drafts and try again`;
  }
}
