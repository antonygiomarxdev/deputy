import { z } from "zod";
import { num, numOrNull, str, strOrNull } from "../../../adapters/sqlite/row";
import type { Instant } from "../../../shared/instant";
import type { ProviderName } from "../../../shared/provider-name";
import type { SqlExecutor, SqlRow } from "../../../shared/sql-database";
import { STORED_REASONS, SyncState, type OutboundResume, type StoredReason, type SyncStateProps } from "../../domain/sync-state";
import type { SyncStateRepository } from "../../ports/sync-state-repository";
import { providerOf } from "./decode";

const reasonSchema = z.enum(STORED_REASONS);
const resumeSchema = z.object({ cursor: z.string(), from: z.number().nullable(), runStart: z.number() });

function reasonOf(r: SqlRow): StoredReason | null {
  const v = strOrNull(r, "reason");
  return v === null ? null : reasonSchema.parse(v);
}

function resumeOf(r: SqlRow): OutboundResume | null {
  const v = strOrNull(r, "outbound_resume");
  return v === null ? null : resumeSchema.parse(JSON.parse(v));
}

function toProps(r: SqlRow): SyncStateProps {
  const provider = providerOf(r);
  const status = str(r, "status");
  if (status !== "complete" && status !== "failed") throw new Error(`status '${status}'`);
  const gapStored = numOrNull(r, "gap_stored_at");
  const gapReturned = numOrNull(r, "gap_returned_at");
  return {
    provider,
    status,
    reason: reasonOf(r),
    lastAttemptAt: numOrNull(r, "last_attempt_at"),
    lastSuccessAt: numOrNull(r, "last_success_at"),
    runStartedAt: numOrNull(r, "run_started_at"),
    connectedAt: numOrNull(r, "connected_at"),
    markConversations: numOrNull(r, "mark_conversations"),
    markOutbound: numOrNull(r, "mark_outbound"),
    outboundResume: resumeOf(r),
    failedSince: numOrNull(r, "failed_since"),
    rateLimitedSince: numOrNull(r, "rate_limited_since"),
    retryAt: numOrNull(r, "retry_at"),
    gap: gapStored === null || gapReturned === null ? null : { storedAt: gapStored, returnedAt: gapReturned },
    firstImportCount: num(r, "first_import_count"),
    liveVerifiedAt: numOrNull(r, "live_verified_at"),
    finishedAt: numOrNull(r, "finished_at"),
  };
}

// SQLite's two-argument MAX is NULL when either side is NULL, so each side falls back to the other.
const later = (col: string): string =>
  `MAX(COALESCE(catchup_status.${col}, excluded.${col}), COALESCE(excluded.${col}, catchup_status.${col}))`;

export class SqliteSyncStateRepository implements SyncStateRepository {
  constructor(private readonly ex: SqlExecutor) {}

  async connectedAt(provider: ProviderName): Promise<Instant | null> {
    return this.column(provider, "connected_at");
  }

  // A live delivery before the first catch-up creates the row as failed with no reason (SPEC-02, Context 4).
  async markLiveVerified(provider: ProviderName, at: Instant): Promise<void> {
    await this.ex.run(
      `INSERT INTO catchup_status (provider, status, live_verified_at) VALUES (?, 'failed', ?)
       ON CONFLICT (provider) DO UPDATE SET live_verified_at = excluded.live_verified_at`,
      [provider, at],
    );
  }

  async liveVerifiedAt(provider: ProviderName): Promise<Instant | null> {
    return this.column(provider, "live_verified_at");
  }

  async load(provider: ProviderName): Promise<SyncState | null> {
    const [r] = await this.ex.query("SELECT * FROM catchup_status WHERE provider = ?", [provider]);
    return r === undefined ? null : SyncState.rehydrate(toProps(r));
  }

  async save(s: SyncState): Promise<void> {
    const p = s.props;
    await this.ex.run(
      `INSERT INTO catchup_status
         (provider, status, reason, last_attempt_at, last_success_at, run_started_at, connected_at, mark_conversations,
          mark_outbound, outbound_resume, failed_since, rate_limited_since, retry_at, gap_stored_at, gap_returned_at, first_import_count, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (provider) DO UPDATE SET
         status = excluded.status, reason = excluded.reason,
         last_attempt_at = excluded.last_attempt_at, last_success_at = excluded.last_success_at,
         run_started_at = excluded.run_started_at,
         connected_at = COALESCE(catchup_status.connected_at, excluded.connected_at),
         mark_conversations = ${later("mark_conversations")},
         mark_outbound = ${later("mark_outbound")},
         outbound_resume = excluded.outbound_resume,
         failed_since = excluded.failed_since, rate_limited_since = excluded.rate_limited_since, retry_at = excluded.retry_at,
         gap_stored_at = excluded.gap_stored_at, gap_returned_at = excluded.gap_returned_at,
         first_import_count = excluded.first_import_count, finished_at = excluded.finished_at`,
      [
        p.provider, p.status, p.reason, p.lastAttemptAt, p.lastSuccessAt, p.runStartedAt, p.connectedAt,
        p.markConversations, p.markOutbound, p.outboundResume === null ? null : JSON.stringify(p.outboundResume),
        p.failedSince, p.rateLimitedSince, p.retryAt, p.gap?.storedAt ?? null, p.gap?.returnedAt ?? null, p.firstImportCount, p.finishedAt,
      ],
    );
  }

  private async column(provider: ProviderName, name: "connected_at" | "live_verified_at"): Promise<Instant | null> {
    const [r] = await this.ex.query(`SELECT ${name} AS v FROM catchup_status WHERE provider = ?`, [provider]);
    return r === undefined ? null : numOrNull(r, "v");
  }
}
