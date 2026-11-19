import type { OutgoingSend } from "../domain/outgoing-send";
import type { SendTextResult } from "../ports/send-text";

/** What the send's record says now: the answer to the owner, and what a repeat call with the same send id gets back. */
export function recorded(send: OutgoingSend): SendTextResult {
  const p = send.props;
  const sent = p.parts.filter((x) => x.state === "sent");
  if (p.state === "sent") return { kind: "sent", providerMessageIds: sent.map((x) => x.providerMessageId ?? "") };
  if (p.state === "failed") {
    if (p.failureReason === "rate_limited") return { kind: "rate_limited", retryAt: p.retryAt ?? p.finishedAt ?? p.createdAt };
    const reason = p.failureReason;
    return { kind: "failed", reason: reason === "credentials" || reason === "unreachable" || reason === "quota" ? reason : "rejected" };
  }
  return { kind: "unknown", partsSent: sent.length, partsTotal: p.parts.length };
}
