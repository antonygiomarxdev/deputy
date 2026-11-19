import type { Clock } from "../../../shared/clock";
import type { Instant } from "../../../shared/instant";
import type { Secret } from "../../domain/secret";
import { ProviderError } from "../../ports/provider";
import { Pacer } from "./pacer";

export interface KapsoHttpOptions {
  baseUrl: string;
  apiKey: Secret;
  clock: Clock;
  timeoutMs: number;
}

export type KapsoResponse = { body: unknown; serverTime: Instant; remaining: number | null };

/** One Kapso HTTP call: the key header, the timeout, the status-to-error mapping and the request pacing. */
export class KapsoHttp {
  private readonly pacer: Pacer;

  constructor(private readonly o: KapsoHttpOptions) {
    this.pacer = new Pacer(o.clock);
  }

  async request(
    method: "GET" | "POST",
    path: string,
    payload: unknown,
    signal: AbortSignal,
    isSend: boolean,
  ): Promise<KapsoResponse> {
    // reads keep a reserve of the minute for sends: they wait for the next provider minute when it runs low; sends never wait
    if (!isSend) await this.pacer.beforeRead();
    const timeout = AbortSignal.timeout(this.o.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.o.baseUrl}${path}`, {
        method,
        headers: {
          "X-API-Key": this.o.apiKey.reveal(),
          ...(payload === null ? {} : { "content-type": "application/json" }),
        },
        body: payload === null ? null : JSON.stringify(payload),
        signal: AbortSignal.any([signal, timeout]),
      });
    } catch {
      if (signal.aborted) throw new ProviderError("timeout", null, isSend);
      throw new ProviderError(timeout.aborted ? "timeout" : "unreachable", null, isSend);
    }

    if (res.status === 401 || res.status === 403) throw new ProviderError("credentials", null, false);
    if (res.status === 402) throw new ProviderError("quota", null, false);
    if (res.status === 429) {
      const seconds = Number(res.headers.get("retry-after"));
      throw new ProviderError("rate_limited", Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null, false);
    }
    if (res.status >= 500) throw new ProviderError("unreachable", null, isSend);
    if (!res.ok) throw new ProviderError("bad_response", null, false);

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ProviderError(timeout.aborted ? "timeout" : "bad_response", null, timeout.aborted && isSend);
    }
    const date = Date.parse(res.headers.get("date") ?? "");
    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "");
    const result = {
      body,
      serverTime: Number.isNaN(date) ? this.o.clock.now() : date,
      remaining: res.headers.has("x-ratelimit-remaining") && Number.isFinite(remaining) ? remaining : null,
    };
    this.pacer.observe(result);
    return result;
  }
}
