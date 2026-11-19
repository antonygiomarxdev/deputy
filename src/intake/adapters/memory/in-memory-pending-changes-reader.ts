import type { PendingChangesReader } from "../../ports/pending-changes-reader";
import type { State } from "./in-memory-state";

export function inMemoryPendingChanges(s: () => State): PendingChangesReader {
  return {
    async takeOwnerNumberChanges() {
      return s()
        .pending.filter((p) => p.appliedAt === null)
        .sort((a, b) => a.at - b.at || a.id - b.id)
        .map(({ appliedAt: _applied, ...change }) => change);
    },
    async markApplied(id, at) {
      const row = s().pending.find((p) => p.id === id);
      if (row !== undefined) row.appliedAt = at;
    },
  };
}
