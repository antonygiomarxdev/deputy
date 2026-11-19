import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";
import { RATE_LIMIT_DEFAULT_WAIT_MS, TELL_OWNER_AFTER_MS } from "./constants";

/** Every reason a stored sync state can carry. The SQLite decoder reads its schema from this list: add a reason here only. */
export const STORED_REASONS = [
  "unreachable", "credentials", "quota", "usage_limit", "timeout", "bad_response", "possible_gap", "catching_up", "storage",
] as const;
export type StoredReason = (typeof STORED_REASONS)[number];
export type SyncReason = "not_yet_run" | StoredReason;

export interface OutboundResume {
  readonly cursor: string;
  readonly from: Instant | null;
  readonly runStart: Instant;
}

export interface SyncStateProps {
  provider: ProviderName;
  status: "complete" | "failed";
  reason: StoredReason | null;
  lastAttemptAt: Instant | null; // local clock
  lastSuccessAt: Instant | null; // local clock
  runStartedAt: Instant | null; // local clock
  connectedAt: Instant | null; // provider clock, set once
  markConversations: Instant | null; // provider clock
  markOutbound: Instant | null; // provider clock
  outboundResume: OutboundResume | null;
  failedSince: Instant | null;
  rateLimitedSince: Instant | null;
  retryAt: Instant | null;
  gap: { storedAt: Instant; returnedAt: Instant } | null;
  firstImportCount: number;
  liveVerifiedAt: Instant | null;
}

const later = (a: Instant | null, b: Instant): Instant => (a === null || b > a ? b : a);

export class SyncState {
  private constructor(private p: SyncStateProps) {}

  /** lastAttemptAt is null: "not yet run". */
  static initial(provider: ProviderName): SyncState {
    return new SyncState({
      provider,
      status: "failed",
      reason: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      runStartedAt: null,
      connectedAt: null,
      markConversations: null,
      markOutbound: null,
      outboundResume: null,
      failedSince: null,
      rateLimitedSince: null,
      retryAt: null,
      gap: null,
      firstImportCount: 0,
      liveVerifiedAt: null,
    });
  }

  static rehydrate(p: SyncStateProps): SyncState {
    return new SyncState({ ...p });
  }

  get props(): Readonly<SyncStateProps> {
    return this.p;
  }

  isNotYetRun(): boolean {
    return this.p.lastAttemptAt === null;
  }

  /** A run began, whether or not the provider answered: a failed first call is an attempt, not "not yet run". */
  markAttempt(now: Instant): void {
    this.p = { ...this.p, lastAttemptAt: now, runStartedAt: now };
  }

  begin(i: { providerTime: Instant; now: Instant }): void {
    this.p = { ...this.p, lastAttemptAt: i.now, runStartedAt: i.now, connectedAt: this.p.connectedAt ?? i.providerTime };
  }

  /** Never moves back. */
  advanceConversations(to: Instant): void {
    this.p = { ...this.p, markConversations: later(this.p.markConversations, to) };
  }

  completeConversations(runStart: Instant): void {
    this.advanceConversations(runStart);
  }

  saveOutboundResume(r: OutboundResume): void {
    this.p = { ...this.p, outboundResume: r };
  }

  completeOutbound(runStart: Instant): void {
    this.p = { ...this.p, markOutbound: later(this.p.markOutbound, runStart), outboundResume: null };
  }

  /** Counts only until the first success: the first import is what the owner is told about. */
  countStored(n: number): void {
    if (this.p.lastSuccessAt === null) this.p = { ...this.p, firstImportCount: this.p.firstImportCount + n };
  }

  complete(now: Instant): void {
    this.p = {
      ...this.p,
      status: "complete",
      reason: null,
      lastSuccessAt: now,
      failedSince: null,
      rateLimitedSince: null,
      retryAt: null,
      gap: null,
    };
  }

  /** possible_gap is set through setGap first. */
  fail(reason: StoredReason, now: Instant, retryAfterMs?: number | null): void {
    const usageLimit = reason === "usage_limit";
    this.p = {
      ...this.p,
      status: "failed",
      reason,
      failedSince: this.p.failedSince ?? now,
      rateLimitedSince: usageLimit ? (this.p.rateLimitedSince ?? now) : this.p.rateLimitedSince,
      // a retry wait of 0 or less is no wait at all: it counts as absent, or the scheduler would loop
      retryAt: usageLimit ? now + (retryAfterMs !== undefined && retryAfterMs !== null && retryAfterMs > 0 ? retryAfterMs : RATE_LIMIT_DEFAULT_WAIT_MS) : null,
    };
  }

  setGap(g: { storedAt: Instant; returnedAt: Instant }): void {
    this.p = { ...this.p, gap: g };
  }

  /** A short refusal streak is not worth an interruption. */
  tellOwner(now: Instant): boolean {
    if (this.p.status === "complete") return false;
    if (this.p.reason === "usage_limit" && this.p.rateLimitedSince !== null) {
      return now - this.p.rateLimitedSince >= TELL_OWNER_AFTER_MS;
    }
    return true;
  }
}
