import { LeaseLost, LogUnavailable, StaleDraft } from "../domain/errors";
import type { Refusal } from "../domain/refusals";
import type { Outcome } from "../ports/inbound";

export function refuse(refusal: Refusal): Outcome<never> {
  return { ok: false, refusal };
}

/** Maps the errors a unit of work throws to the refusal the owner sees. Anything else is a bug and propagates. */
export function refusalOfError(e: unknown): Outcome<never> {
  if (e instanceof LogUnavailable) return refuse({ code: "log_unavailable" });
  if (e instanceof StaleDraft) return refuse({ code: "stale_draft", number: e.draft });
  if (e instanceof LeaseLost) return refuse({ code: "not_owner" });
  throw e;
}
