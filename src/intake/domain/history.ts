import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";
import type { Source } from "../../shared/source";

export function isHistory(i: {
  provider: ProviderName;
  connectedAt: Instant | null;
  sentAt: Instant;
  origin: string | null;
  source: Source;
}): boolean {
  // a tester controls dev history with `history: true`, which the adapter turns into this origin
  if (i.provider === "dev") return i.origin === "history_sync";
  const beforeConnect = i.connectedAt !== null && i.sentAt < i.connectedAt;
  return beforeConnect || (i.origin === "history_sync" && i.source === "customer");
}
