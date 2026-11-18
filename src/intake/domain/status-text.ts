import type { Instant } from "../../shared/instant";
import type { SyncReason } from "./sync-state";

export function formatInstant(t: Instant): string {
  return new Date(t).toISOString();
}

const SENTENCE: Record<Exclude<SyncReason, "possible_gap">, string> = {
  not_yet_run: "Deputy has not checked Kapso yet.",
  unreachable: "Could not reach Kapso.",
  credentials: "Kapso did not accept the key. Check it where Setup put it.",
  quota: "The Kapso message quota is used up.",
  usage_limit: "Kapso asked me to slow down.",
  timeout: "Kapso did not answer in time.",
  bad_response: "Kapso sent an answer I could not read.",
  catching_up: "Still catching up. Messages stored so far are kept.",
  storage: "Deputy could not write to its storage.",
};

/** English only (D20). The text never holds provider text. */
export function reasonText(
  r: SyncReason,
  i: { newestStoredAt: Instant | null; gap: { storedAt: Instant; returnedAt: Instant } | null },
): string {
  const head =
    r !== "possible_gap"
      ? SENTENCE[r]
      : i.gap === null
        ? "Some messages may be missing. Check the WhatsApp Business app."
        : `Some messages between ${formatInstant(i.gap.storedAt)} and ${formatInstant(i.gap.returnedAt)} may be missing. Check the WhatsApp Business app for that period.`;
  const tail =
    i.newestStoredAt === null ? " I have no messages yet." : ` The newest message I have is from ${formatInstant(i.newestStoredAt)}.`;
  return head + tail;
}
