import type { ProviderName } from "../../shared/provider-name";

export type ResolvedProvider =
  | { ok: true; provider: ProviderName; receiving: "catch_up" | "live"; notices: string[] }
  | { ok: false; message: string };

export interface ResolveProviderSettings {
  execute(): Promise<ResolvedProvider>;
}
