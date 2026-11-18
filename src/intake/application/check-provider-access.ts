import type { CheckProviderAccess } from "../ports/check-provider-access";
import { ProviderError, type Provider, type ProviderErrorKind } from "../ports/provider";

type Failure = Extract<Awaited<ReturnType<CheckProviderAccess["execute"]>>, { ok: false }>["reason"];

const REASON: Record<ProviderErrorKind, Failure> = {
  credentials: "credentials",
  unreachable: "unreachable",
  quota: "quota",
  rate_limited: "usage_limit",
  timeout: "timeout",
  bad_response: "unreachable",
};

/** Reads one conversation listing and the business number; it writes nothing. */
export class CheckProviderAccessUseCase implements CheckProviderAccess {
  constructor(private readonly provider: Provider) {}

  async execute() {
    const signal = new AbortController().signal;
    try {
      await this.provider.listConversations({ activeAfter: null, cursor: null, limit: 1 }, signal);
      const number = await this.provider.businessNumber(signal);
      return { ok: true as const, businessNumber: number?.e164 ?? null };
    } catch (e) {
      if (e instanceof ProviderError) return { ok: false as const, reason: REASON[e.kind] };
      throw e;
    }
  }
}
