import type { SyncStatusView } from "./get-sync-status";

export interface CatchUp {
  execute(q: { trigger: "start" | "timer" | "asked" | "retry"; waitMs?: number /* default CALLER_WAIT_MS */ }): Promise<
    | { kind: "finished"; status: SyncStatusView; stored: number }
    | { kind: "still_running"; status: SyncStatusView }
    | { kind: "refused"; reason: "not_owner" }
  >;
}
