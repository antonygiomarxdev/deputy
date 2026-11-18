import { flag, num, numOrNull, str } from "../../../adapters/sqlite/row";
import type { Instant } from "../../../shared/instant";
import type { SqlExecutor } from "../../../shared/sql-database";
import type { RejectionNote, RejectionReason } from "../../domain/rejection-note";
import { REJECTION_MAX_AGE_MS, REJECTION_MAX_ROWS, type RejectionRepository } from "../../ports/rejection-repository";

const REASONS: readonly string[] = [
  "bad_signature", "missing_signature", "no_secret", "no_identifier", "malformed", "dev_entry_refused",
];

function reasonOf(s: string): RejectionReason {
  const found = REASONS.find((r) => r === s);
  if (found === undefined) throw new Error(`rejection reason '${s}'`);
  return found as RejectionReason; // checked against the closed list above
}

export class SqliteRejectionRepository implements RejectionRepository {
  constructor(private readonly ex: SqlExecutor) {}

  async add(at: Instant, reason: RejectionReason, recoverable: boolean): Promise<void> {
    await this.ex.run("INSERT INTO rejections (at, reason, recoverable) VALUES (?, ?, ?)", [at, reason, recoverable ? 1 : 0]);
    const old = await this.ex.run("DELETE FROM rejections WHERE at < ?", [at - REJECTION_MAX_AGE_MS]);
    const over = await this.ex.run(
      "DELETE FROM rejections WHERE id NOT IN (SELECT id FROM rejections ORDER BY id DESC LIMIT ?)",
      [REJECTION_MAX_ROWS],
    );
    const deleted = old.changes + over.changes;
    if (deleted > 0) {
      await this.ex.run("UPDATE rejection_pruned SET count = count + ?, last_prune_at = ? WHERE id = 1", [deleted, at]);
    }
  }

  async list(): Promise<{ notes: RejectionNote[]; prunedCount: number; unrecovered: number }> {
    const rows = await this.ex.query("SELECT at, reason, recoverable, resolved_at FROM rejections ORDER BY id DESC");
    const [pruned] = await this.ex.query("SELECT count FROM rejection_pruned WHERE id = 1");
    const notes = rows.map((r) => ({
      at: num(r, "at"),
      reason: reasonOf(str(r, "reason")),
      recoverable: flag(r, "recoverable"),
      resolvedAt: numOrNull(r, "resolved_at"),
    }));
    return {
      notes,
      prunedCount: pruned === undefined ? 0 : num(pruned, "count"),
      unrecovered: notes.filter((n) => n.recoverable && n.resolvedAt === null).length,
    };
  }

  async resolveRecoverableBefore(runStartedAt: Instant, at: Instant): Promise<void> {
    await this.ex.run(
      "UPDATE rejections SET resolved_at = ? WHERE recoverable = 1 AND resolved_at IS NULL AND at < ?",
      [at, runStartedAt],
    );
  }
}
