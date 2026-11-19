import type { Instant } from "../../../shared/instant";
import type { RejectionReason } from "../../domain/rejection-note";
import { REJECTION_MAX_AGE_MS, REJECTION_MAX_ROWS, type RejectionRepository } from "../../ports/rejection-repository";
import type { State } from "./in-memory-state";

export function inMemoryRejectionRepository(s: () => State): RejectionRepository {
  return {
    async add(at: Instant, reason: RejectionReason, recoverable: boolean) {
      s().rejections.push({ id: s().nextRejectionId++, at, reason, recoverable, resolvedAt: null });
      const before = s().rejections.length;
      s().rejections = s().rejections.filter((r) => r.at >= at - REJECTION_MAX_AGE_MS);
      s().rejections = s().rejections.slice(-REJECTION_MAX_ROWS);
      s().pruned += before - s().rejections.length;
    },
    async list() {
      const notes = [...s().rejections].reverse().map(({ at, reason, recoverable, resolvedAt }) => ({ at, reason, recoverable, resolvedAt }));
      return {
        notes,
        prunedCount: s().pruned,
        unrecovered: notes.filter((n) => n.recoverable && n.resolvedAt === null).length,
      };
    },
    async resolveRecoverableBefore(runStartedAt, at) {
      s().rejections = s().rejections.map((r) =>
        r.recoverable && r.resolvedAt === null && r.at < runStartedAt ? { ...r, resolvedAt: at } : r,
      );
    },
  };
}
