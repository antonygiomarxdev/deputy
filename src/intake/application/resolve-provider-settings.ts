import type { IntakeConnectionConfig } from "../ports/intake-connection-config";
import type { OwnerNumbersRepository } from "../ports/owner-numbers-repository";
import type { ResolvedProvider, ResolveProviderSettings } from "../ports/resolve-provider-settings";

export class ResolveProviderSettingsUseCase implements ResolveProviderSettings {
  constructor(private readonly deps: { config: IntakeConnectionConfig; owners: OwnerNumbersRepository }) {}

  async execute(): Promise<ResolvedProvider> {
    const c = await this.deps.config.read();
    const notices: string[] = [];

    let provider: "kapso" | "dev";
    if (!c.provider) {
      provider = "dev";
      notices.push("no provider set, using dev");
    } else if (c.provider === "kapso" || c.provider === "dev") {
      provider = c.provider;
    } else {
      return { ok: false, message: `provider must be kapso or dev, got '${c.provider}'` };
    }

    const mode = c.receivingMode || null;
    const live = mode === "live" && provider === "kapso";
    const blank = (v: string | null | { reveal(): string }) => v === null || (typeof v === "string" ? v : v.reveal()).trim() === "";

    if (provider === "kapso") {
      const missing = [
        blank(c.kapso.apiKey) ? "api key" : null,
        blank(c.kapso.phoneNumberId) ? "phone number id" : null,
        live && blank(c.kapso.webhookSecret) ? "webhook secret" : null,
        (await this.deps.owners.load()).business() ? null : "business number",
      ].filter((m) => m !== null);
      if (missing.length > 0) return { ok: false, message: `Kapso needs: ${missing.join(", ")}. Run Setup.` };
    }

    if (mode !== null && mode !== "live" && mode !== "catch-up") {
      return { ok: false, message: `receiving_mode must be catch-up or live, got '${mode}'` };
    }

    return { ok: true, provider, receiving: live ? "live" : "catch_up", notices };
  }
}
